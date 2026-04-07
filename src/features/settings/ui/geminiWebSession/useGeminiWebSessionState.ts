import { useCallback, useMemo } from 'react'
import {
  useAppToolActions,
  useAppToolFlagsState,
  useLanguageStrings,
  useToastActions
} from '@app/providers'
import type { GeminiWebSessionActionResult } from '@shared-core/types'
import {
  DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
  GOOGLE_WEB_SESSION_APPS,
  type GoogleWebSessionAppId
} from '@shared-core/constants/google-ai-web-apps'
import { useLocalStorage } from '@shared/hooks'
import {
  useGeminiWebCheckNow,
  useGeminiWebReauth,
  useGeminiWebResetProfile,
  useGeminiWebSetEnabledApps,
  useGeminiWebSetEnabled,
  useGeminiWebStatus
} from '@platform/electron/api/useGeminiWebSessionApi'
import type {
  GeminiWebSessionActionState,
  GeminiWebSessionHandlers,
  GeminiWebSessionStatusView
} from './types'

const MANAGED_APP_IDS = new Set(GOOGLE_WEB_SESSION_APPS.map((app) => app.id))

export function useGeminiWebSessionState() {
  const { t } = useLanguageStrings()
  const { showError } = useToastActions()
  const {
    data: webSessionData,
    isLoading: isWebSessionLoading,
    isRefetching: isWebSessionRefetching,
    refetch: refetchWebSession
  } = useGeminiWebStatus({
    refetchInterval: (query) => {
      const state = query.state.data?.state
      const available = query.state.data?.featureEnabled
      const enabled = query.state.data?.enabled

      if (!available || !enabled) return false
      if (state === 'authenticated') return false
      return 60_000
    }
  })

  const { isGeminiWebLoginInProgress } = useAppToolFlagsState()
  const { startGeminiWebLogin } = useAppToolActions()
  const { mutateAsync: checkWebNow, isPending: isCheckingWebNow } = useGeminiWebCheckNow()
  const { mutateAsync: reauthWeb, isPending: isReauthingWeb } = useGeminiWebReauth()
  const { mutateAsync: resetWebProfile, isPending: isResettingWebProfile } =
    useGeminiWebResetProfile()
  const { mutateAsync: setWebEnabled, isPending: isTogglingWebEnabled } = useGeminiWebSetEnabled()
  const { mutateAsync: setWebEnabledApps } = useGeminiWebSetEnabledApps()
  const [enabledGoogleApps, setEnabledGoogleApps] = useLocalStorage<GoogleWebSessionAppId[]>(
    'gwsEnabledApps',
    DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS
  )

  const enabledAppIds = useMemo(
    () => new Set(enabledGoogleApps.filter((appId) => MANAGED_APP_IDS.has(appId))),
    [enabledGoogleApps]
  )

  const status = useMemo<GeminiWebSessionStatusView>(() => {
    const state = webSessionData?.state || 'uninitialized'
    const reason = webSessionData?.reasonCode || 'none'
    const checking = isWebSessionLoading || isWebSessionRefetching || isCheckingWebNow
    const featureEnabled = !!webSessionData?.featureEnabled
    const userEnabled = !!webSessionData?.enabled
    const webEnabled = featureEnabled && userEnabled

    return {
      state,
      reason,
      checking,
      featureEnabled,
      userEnabled,
      webEnabled,
      isAuthenticated: state === 'authenticated',
      needsReauth: state === 'reauth_required',
      isDegraded: state === 'degraded',
      lastCheckAt: webSessionData?.lastCheckAt || null
    }
  }, [webSessionData, isWebSessionLoading, isWebSessionRefetching, isCheckingWebNow])

  const reasonText = useMemo(() => {
    const reasonKey = `gws_reason_${status.reason}`
    const translated = t(reasonKey)
    return translated === reasonKey ? status.reason : translated
  }, [status.reason, t])

  const stateText = useMemo(() => {
    if (!status.featureEnabled) return t('gws_feature_disabled')
    if (!status.userEnabled) return t('gws_state_disabled')
    if (status.isAuthenticated) return t('gws_state_authenticated')
    if (status.needsReauth) return t('gws_state_reauth_required')
    if (status.isDegraded) return t('gws_state_degraded')
    return t('gws_state_auth_required')
  }, [status, t])

  const riskItems = useMemo(
    () => [
      t('gws_risk_unofficial'),
      t('gws_risk_challenge'),
      t('gws_risk_expiry'),
      t('gws_risk_profile_access'),
      t('gws_risk_behavior_changes'),
      t('gws_risk_multi_device')
    ],
    [t]
  )

  const mitigationItems = useMemo(
    () => [
      t('gws_mitigation_dedicated_profile'),
      t('gws_mitigation_stable_network'),
      t('gws_mitigation_manual_reauth'),
      t('gws_mitigation_no_shared_machine')
    ],
    [t]
  )

  const runSessionAction = useCallback(
    async (
      action: () => Promise<GeminiWebSessionActionResult>,
      options?: { refetch?: boolean }
    ) => {
      try {
        const result = await action()
        if (!result?.success && result?.error) {
          showError(result.error)
        }
        if (options?.refetch) {
          await refetchWebSession()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t('error_unknown_error')
        showError(message)
      }
    },
    [refetchWebSession, showError]
  )

  const handlers = useMemo<GeminiWebSessionHandlers>(
    () => ({
      onOpenWebLogin: () => {
        void runSessionAction(startGeminiWebLogin)
      },
      onCheckWebNow: () => {
        void runSessionAction(checkWebNow, { refetch: true })
      },
      onReauthWeb: () => {
        void runSessionAction(reauthWeb)
      },
      onResetWebProfile: () => {
        void runSessionAction(resetWebProfile)
      },
      onToggleWebEnabled: () => {
        void runSessionAction(() => setWebEnabled(!status.userEnabled))
      },
      onToggleManagedApp: (appId: GoogleWebSessionAppId) => {
        const nextEnabledAppIds = enabledAppIds.has(appId)
          ? GOOGLE_WEB_SESSION_APPS.filter(
              (app) => app.id !== appId && enabledAppIds.has(app.id)
            ).map((app) => app.id)
          : GOOGLE_WEB_SESSION_APPS.filter(
              (app) => enabledAppIds.has(app.id) || app.id === appId
            ).map((app) => app.id)

        setEnabledGoogleApps(nextEnabledAppIds)
        void runSessionAction(() => setWebEnabledApps(nextEnabledAppIds), { refetch: true })
      }
    }),
    [
      runSessionAction,
      startGeminiWebLogin,
      checkWebNow,
      reauthWeb,
      resetWebProfile,
      setWebEnabled,
      setWebEnabledApps,
      status.userEnabled,
      enabledAppIds,
      setEnabledGoogleApps
    ]
  )

  const actionState = useMemo<GeminiWebSessionActionState>(
    () => ({
      isGeminiWebLoginInProgress,
      isCheckingWebNow,
      isReauthingWeb,
      isResettingWebProfile,
      isTogglingWebEnabled
    }),
    [
      isGeminiWebLoginInProgress,
      isCheckingWebNow,
      isReauthingWeb,
      isResettingWebProfile,
      isTogglingWebEnabled
    ]
  )

  return {
    t,
    status,
    reasonText,
    stateText,
    enabledAppIds,
    riskItems,
    mitigationItems,
    actionState,
    handlers
  }
}
