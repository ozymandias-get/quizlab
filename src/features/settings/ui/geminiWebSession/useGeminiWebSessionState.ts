import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useAppToolActions,
  useAppToolFlagsState,
  useLanguageStrings,
  useToastActions
} from '@app/providers'
import { getElectronApi } from '@shared/lib/electronApi'
import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionRefreshEvent,
  GeminiWebSessionRefreshReason
} from '@shared-core/types'
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
const REQUIRES_LOGIN_ERROR = 'error_refresh_failed_requires_login'

const resultRequiresManualLogin = (result?: GeminiWebSessionActionResult | null) => {
  if (!result) return false
  if (result.error === REQUIRES_LOGIN_ERROR) return true
  if (result.status?.state === 'reauth_required') return true
  return false
}

export function useGeminiWebSessionState() {
  const { t } = useLanguageStrings()
  const { showError } = useToastActions()
  const {
    data: webSessionData,
    isLoading: isWebSessionLoading,
    isRefetching: isWebSessionRefetching,
    refetch: refetchWebSession
  } = useGeminiWebStatus()

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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshReason, setLastRefreshReason] = useState<GeminiWebSessionRefreshReason | null>(
    null
  )
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [requiresManualLogin, setRequiresManualLogin] = useState(false)
  const isRefreshingRef = useRef(isRefreshing)

  useEffect(() => {
    isRefreshingRef.current = isRefreshing
  }, [isRefreshing])

  useEffect(() => {
    const electronApi = getElectronApi()
    const unsubscribe = electronApi.geminiWeb.onRefreshEvent(
      (event: GeminiWebSessionRefreshEvent) => {
        setLastRefreshReason(event.reason)

        switch (event.phase) {
          case 'started':
            setIsRefreshing(true)
            setRequiresManualLogin(false)
            break
          case 'success':
            setIsRefreshing(false)
            setLastRefreshedAt(new Date().toISOString())
            setRequiresManualLogin(false)
            void refetchWebSession()
            break
          case 'failed':
            setIsRefreshing(false)
            if (event.error === REQUIRES_LOGIN_ERROR) {
              setRequiresManualLogin(true)
            }
            void refetchWebSession()
            break
          default:
            break
        }
      }
    )

    return () => {
      unsubscribe()
    }
  }, [refetchWebSession])

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
    const needsReauth = state === 'reauth_required'

    return {
      state,
      reason,
      checking,
      isRefreshing,
      featureEnabled,
      userEnabled,
      webEnabled,
      isAuthenticated: state === 'authenticated',
      needsReauth,
      isDegraded: state === 'degraded',
      lastCheckAt: webSessionData?.lastCheckAt || null,
      lastRefreshedAt,
      lastRefreshReason,
      requiresManualLogin,
      showReauthAlert: requiresManualLogin || needsReauth
    }
  }, [
    webSessionData,
    isWebSessionLoading,
    isWebSessionRefetching,
    isCheckingWebNow,
    isRefreshing,
    lastRefreshedAt,
    lastRefreshReason,
    requiresManualLogin
  ])

  const reasonText = useMemo(() => {
    const reasonKey = `gws_reason_${status.reason}`
    const translated = t(reasonKey)
    return translated === reasonKey ? status.reason : translated
  }, [status.reason, t])

  const refreshReasonText = useMemo(() => {
    if (!status.lastRefreshReason) return null
    const reasonKey = `gws_refresh_reason_${status.lastRefreshReason}`
    const translated = t(reasonKey)
    return translated === reasonKey ? status.lastRefreshReason : translated
  }, [status.lastRefreshReason, t])

  const stateText = useMemo(() => {
    if (!status.featureEnabled) return t('gws_feature_disabled')
    if (!status.userEnabled) return t('gws_state_disabled')
    if (status.isRefreshing) return t('gws_state_refreshing')
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
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : t('error_unknown_error')
        showError(message)
        return null
      }
    },
    [refetchWebSession, showError, t]
  )

  const handlers = useMemo<GeminiWebSessionHandlers>(
    () => ({
      onOpenWebLogin: () => {
        setRequiresManualLogin(false)
        void runSessionAction(startGeminiWebLogin)
      },
      onCheckWebNow: () => {
        void runSessionAction(checkWebNow, { refetch: true }).then((result) => {
          if (!isRefreshingRef.current && resultRequiresManualLogin(result)) {
            setRequiresManualLogin(true)
          }
        })
      },
      onReauthWeb: () => {
        setRequiresManualLogin(false)
        void runSessionAction(reauthWeb)
      },
      onResetWebProfile: () => {
        setRequiresManualLogin(false)
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
      isTogglingWebEnabled,
      isRefreshing
    }),
    [
      isGeminiWebLoginInProgress,
      isCheckingWebNow,
      isReauthingWeb,
      isResettingWebProfile,
      isTogglingWebEnabled,
      isRefreshing
    ]
  )

  return {
    t,
    status,
    reasonText,
    refreshReasonText,
    stateText,
    enabledAppIds,
    riskItems,
    mitigationItems,
    actionState,
    handlers
  }
}
