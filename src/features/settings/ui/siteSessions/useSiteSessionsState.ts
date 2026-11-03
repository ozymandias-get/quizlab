import type { SiteSessionView } from '@shared-core/types/siteSession'

import {
  useNativeMessagingInstallExtension,
  useNativeMessagingRemoveExtension
} from '@platform/electron/api/useNativeMessagingApi'
import {
  useClearSiteSessionMutation,
  useSetSiteSessionActiveSlotMutation,
  useSetSiteSessionEnabledMutation,
  useSiteSessionListQuery
} from '@platform/electron/api/useSiteSessionApi'

import { useConfirmDialog } from '@shared/hooks'
import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SiteSessionTranslate } from './types'
import { useMitigationItems, useRiskItems } from './wizardContent'

/** The empty list, so the rows keep the same reference between two fetches. */
const NO_VIEWS: SiteSessionView[] = []

/**
 * The state of the site sessions tab: the rows, the two mutations and the
 * extension wizard that sits next to them.
 */
export function useSiteSessionsState() {
  const { t: translate } = useTranslation()
  const t: SiteSessionTranslate = translate
  const { showError, showSuccess, showWarning } = useToastActions()
  const { data } = useSiteSessionListQuery()
  const setEnabledMutation = useSetSiteSessionEnabledMutation()
  const clearMutation = useClearSiteSessionMutation()
  const setActiveSlotMutation = useSetSiteSessionActiveSlotMutation()
  const { mutateAsync: installExtension } = useNativeMessagingInstallExtension()
  const { mutateAsync: removeExtension } = useNativeMessagingRemoveExtension()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<'install' | 'remove' | null>(null)
  /** Sites whose last clear failed; only these are offered for a retry. */
  const [failedClearSiteIds, setFailedClearSiteIds] = useState<string[]>([])
  // A second click on the same switch before the first request settles would
  // read the same stale `view.enabled` and send the same target state twice.
  const pendingToggleSitesRef = useRef<Set<string>>(new Set())
  // Per-site FIFO for slot changes: a rapid second click must not reach the
  // backend before the first request, or a slow earlier response could win.
  const slotQueuesRef = useRef<Map<string, Promise<void>>>(new Map())
  const { confirm, props: confirmProps } = useConfirmDialog()

  const views = data?.views ?? NO_VIEWS
  // Confirmation dialogs resolve asynchronously; re-check against the latest
  // render's views instead of the snapshot captured before the dialog opened.
  const viewsRef = useRef(views)
  viewsRef.current = views
  const failedClearSites = views.filter((view) => failedClearSiteIds.includes(view.siteId))

  /** The service answers a refusal with a stable code the renderer can name. */
  const reportError = useCallback(
    (error?: string) => {
      showError(error ? t(`ws_error_${error}`) : t('error_unknown_error'))
    },
    [showError, t]
  )

  const onToggle = useCallback(
    (siteId: string) => {
      if (pendingToggleSitesRef.current.has(siteId)) return
      const view = views.find((item) => item.siteId === siteId)
      if (!view) return

      pendingToggleSitesRef.current.add(siteId)
      void setEnabledMutation
        .mutateAsync({ siteId, enabled: !view.enabled })
        .then((result) => {
          if (!result.success) reportError(result.error)
        })
        .catch(() => {
          // A thrown mutation already reported itself through the toast.
        })
        .finally(() => {
          pendingToggleSitesRef.current.delete(siteId)
        })
    },
    [reportError, setEnabledMutation, views]
  )

  /**
   * Clears the given sites and reports one aggregate result instead of one
   * toast per failure, so a five-site run cannot look like "nothing happened".
   */
  const clearSites = useCallback(
    async (siteIds: string[]) => {
      if (siteIds.length === 0) return

      const results = await Promise.all(
        siteIds.map(async (siteId) => {
          try {
            const result = await clearMutation.mutateAsync({ siteId })
            return { siteId, ok: result.success }
          } catch {
            // A thrown mutation already surfaced its own error toast.
            return { siteId, ok: false }
          }
        })
      )

      const failedIds = results.filter((result) => !result.ok).map((result) => result.siteId)
      const successCount = results.length - failedIds.length
      setFailedClearSiteIds(failedIds)

      if (failedIds.length === 0) {
        showSuccess(t('ws_clear_all_result_success'), undefined, {
          count: String(successCount)
        })
        return
      }

      const failedNames = views
        .filter((view) => failedIds.includes(view.siteId))
        .map((view) => t(view.labelKey))
        .join(', ')

      showWarning(
        successCount > 0 ? t('ws_clear_all_result_partial') : t('ws_clear_all_result_failed'),
        undefined,
        {
          success: String(successCount),
          failed: String(failedIds.length),
          sites: failedNames
        }
      )
    },
    [clearMutation, showSuccess, showWarning, t, views]
  )

  /**
   * Forgets the sessions the app pulled from Chrome.
   *
   * Only the sites whose import is on are cleared: the session of a site the
   * user signed into inside the app is not ours to throw away.
   */
  const onClearAll = useCallback(async () => {
    const importedViews = views.filter((view) => view.enabled)
    if (importedViews.length === 0) return

    const count = importedViews.length
    const confirmed = await confirm({
      title: t('ws_clear_all_confirm_title'),
      description:
        count === 1
          ? t('ws_clear_all_confirm_one', { count: String(count) })
          : t('ws_clear_all_confirm_other', { count: String(count) }),
      confirmLabel: t('ws_clear_all_btn'),
      variant: 'destructive'
    })
    if (!confirmed) return

    // The user may have toggled imports while the dialog was open. Clear only
    // the confirmed sites that are still enabled right now.
    const latestViews = viewsRef.current
    const stillEnabledIds = importedViews
      .map((view) => view.siteId)
      .filter((siteId) => latestViews.find((view) => view.siteId === siteId)?.enabled)
    await clearSites(stillEnabledIds)
  }, [clearSites, confirm, t, views])

  /**
   * Re-runs only the sites whose previous clear failed. A site whose import
   * was switched off since then is no longer ours to clear, so it is dropped
   * from the retry instead of being cleared behind the user's back.
   */
  const onRetryFailedClear = useCallback(async () => {
    const retryIds = failedClearSiteIds.filter(
      (siteId) => views.find((view) => view.siteId === siteId)?.enabled
    )
    setFailedClearSiteIds(retryIds)
    await clearSites(retryIds)
  }, [clearSites, failedClearSiteIds, views])

  const onSelectSlot = useCallback(
    (siteId: string, slot: number) => {
      const previous = slotQueuesRef.current.get(siteId) ?? Promise.resolve()
      const run = previous
        .catch(() => undefined)
        .then(async () => {
          try {
            const result = await setActiveSlotMutation.mutateAsync({ siteId, slot })
            if (!result.success) reportError(result.error)
          } catch {
            reportError('write_failed')
          }
        })

      slotQueuesRef.current.set(siteId, run)
      void run.finally(() => {
        // Drop the chain only if no newer selection was queued meanwhile.
        if (slotQueuesRef.current.get(siteId) === run) {
          slotQueuesRef.current.delete(siteId)
        }
      })
    },
    [setActiveSlotMutation, reportError]
  )

  const openWizard = useCallback((mode: 'install' | 'remove') => {
    setWizardMode(mode)
    setWizardOpen(true)
  }, [])

  const closeWizard = useCallback(() => {
    setWizardOpen(false)
    setWizardMode(null)
  }, [])

  const riskItems = useRiskItems(t)
  const mitigationItems = useMitigationItems(t)

  return {
    t,
    views,
    /** True while a switch or a clear is on its way to the main process. */
    isBusy:
      setEnabledMutation.isPending || clearMutation.isPending || setActiveSlotMutation.isPending,
    /** Whether there is a session of ours to forget. */
    canClearAll: views.some((view) => view.enabled),
    onToggle,
    onSelectSlot,
    onClearAll,
    onRetryFailedClear,
    failedClearSites,
    confirmProps,
    riskItems,
    mitigationItems,
    wizardOpen,
    wizardMode,
    openWizard,
    closeWizard,
    installExtension,
    removeExtension
  }
}
