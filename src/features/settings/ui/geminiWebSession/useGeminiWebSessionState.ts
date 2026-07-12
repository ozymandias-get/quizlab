import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'
import type {
  GeminiWebSessionActionResult,
  GeminiWebSessionRefreshEvent,
  GeminiWebSessionRefreshReason
} from '@shared-core/types'

import {
  useGeminiWebResetProfile,
  useGeminiWebSetEnabled,
  useGeminiWebSetEnabledApps,
  useGeminiWebStatus
} from '@platform/electron/api/useGeminiWebSessionApi'
import {
  useNativeMessagingInstallExtension,
  useNativeMessagingRemoveExtension
} from '@platform/electron/api/useNativeMessagingApi'

import { useToastActions } from '@app/providers'
import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getNextEnabledManagedAppIds, MANAGED_APP_IDS } from './appUtils'
import {
  computeReasonText,
  computeRefreshReasonText,
  computeStateText,
  createStatusView
} from './statusViewUtils'
import type {
  GeminiWebSessionActionState,
  GeminiWebSessionHandlers,
  GeminiWebSessionStatusView
} from './types'
import { useMitigationItems, useRiskItems } from './wizardContent'

export function useGeminiWebSessionState() {
  const { t } = useTranslation()
  const { showError } = useToastActions()
  const {
    data: webSessionData,
    isLoading: isWebSessionLoading,
    isRefetching: isWebSessionRefetching,
    refetch: refetchWebSession
  } = useGeminiWebStatus()

  const { mutateAsync: resetWebProfile, isPending: isResettingWebProfile } =
    useGeminiWebResetProfile()
  const { mutateAsync: setWebEnabled, isPending: isTogglingWebEnabled } = useGeminiWebSetEnabled()
  const { mutateAsync: setWebEnabledApps } = useGeminiWebSetEnabledApps()
  const { mutateAsync: installExtensionMutation } = useNativeMessagingInstallExtension()
  const { mutateAsync: removeExtensionMutation } = useNativeMessagingRemoveExtension()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshReason, setLastRefreshReason] = useState<GeminiWebSessionRefreshReason | null>(
    null
  )
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<'install' | 'remove' | null>(null)
  const isRefreshingRef = useRef(isRefreshing)

  const closeWizard = useCallback(() => {
    setWizardOpen(false)
    setWizardMode(null)
  }, [])

  useEffect(() => {
    isRefreshingRef.current = isRefreshing
  }, [isRefreshing])

  const safeRefetchWebSession = useCallback(() => {
    void refetchWebSession().catch((err) =>
      reportSuppressedError('geminiWeb.refetchWebSession', { cause: err })
    )
  }, [refetchWebSession])

  useEffect(() => {
    const electronApi = getElectronApi()
    if (!electronApi) return
    const unsubscribe = electronApi.geminiWeb.onRefreshEvent(
      (event: GeminiWebSessionRefreshEvent) => {
        setLastRefreshReason(event.reason)

        switch (event.phase) {
          case 'started':
            setIsRefreshing(true)
            break
          case 'success':
            setIsRefreshing(false)
            setLastRefreshedAt(new Date().toISOString())
            safeRefetchWebSession()
            break
          case 'failed':
            setIsRefreshing(false)
            safeRefetchWebSession()
            break
          default:
            break
        }
      }
    )

    return () => {
      unsubscribe()
    }
  }, [safeRefetchWebSession])

  const enabledAppIds: Set<GoogleWebSessionAppId> = useMemo(
    () =>
      new Set(
        (webSessionData?.enabledAppIds ?? []).filter((appId): appId is GoogleWebSessionAppId =>
          MANAGED_APP_IDS.has(appId as GoogleWebSessionAppId)
        )
      ),
    [webSessionData?.enabledAppIds]
  )

  const status = useMemo<GeminiWebSessionStatusView>(
    () =>
      createStatusView({
        state: webSessionData?.state || 'uninitialized',
        reason: webSessionData?.reasonCode || 'none',
        checking: isWebSessionLoading || isWebSessionRefetching,
        isRefreshing,
        featureEnabled: !!webSessionData?.featureEnabled,
        userEnabled: !!webSessionData?.enabled,
        lastCheckAt: webSessionData?.lastCheckAt || null,
        lastRefreshedAt,
        lastRefreshReason
      }),
    [
      webSessionData,
      isWebSessionLoading,
      isWebSessionRefetching,
      isRefreshing,
      lastRefreshedAt,
      lastRefreshReason
    ]
  )

  const reasonText = useMemo(() => computeReasonText(status.reason, t), [status.reason, t])
  const refreshReasonText = useMemo(
    () => computeRefreshReasonText(status.lastRefreshReason, t),
    [status.lastRefreshReason, t]
  )
  const stateText = useMemo(() => computeStateText(status, t), [status, t])

  const riskItems = useRiskItems(t)
  const mitigationItems = useMitigationItems(t)

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
      onResetWebProfile: () => {
        void runSessionAction(resetWebProfile)
      },
      onToggleWebEnabled: () => {
        void runSessionAction(() => setWebEnabled(!status.userEnabled))
      },
      onToggleManagedApp: (appId: GoogleWebSessionAppId) => {
        const nextEnabledAppIds = getNextEnabledManagedAppIds(appId, enabledAppIds)
        void runSessionAction(() => setWebEnabledApps(nextEnabledAppIds), { refetch: true })
      },
      onInstallExtension: () => {
        setWizardMode('install')
        setWizardOpen(true)
      },
      onRemoveExtension: () => {
        setWizardMode('remove')
        setWizardOpen(true)
      }
    }),
    [
      runSessionAction,
      resetWebProfile,
      setWebEnabled,
      setWebEnabledApps,
      status.userEnabled,
      enabledAppIds,
      setWizardOpen,
      setWizardMode
    ]
  )

  const actionState = useMemo<GeminiWebSessionActionState>(
    () => ({
      isResettingWebProfile,
      isTogglingWebEnabled,
      isRefreshing
    }),
    [isResettingWebProfile, isTogglingWebEnabled, isRefreshing]
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
    handlers,
    wizardOpen,
    wizardMode,
    closeWizard,
    installExtensionMutation,
    removeExtensionMutation
  }
}
