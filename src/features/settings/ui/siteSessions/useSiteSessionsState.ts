import type { SiteSessionView } from '@shared-core/types/siteSession'

import {
  useNativeMessagingInstallExtension,
  useNativeMessagingRemoveExtension
} from '@platform/electron/api/useNativeMessagingApi'
import {
  useClearSiteSessionMutation,
  useSetSiteSessionEnabledMutation,
  useSiteSessionListQuery
} from '@platform/electron/api/useSiteSessionApi'

import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useState } from 'react'
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
  const { showError } = useToastActions()
  const { data } = useSiteSessionListQuery()
  const setEnabledMutation = useSetSiteSessionEnabledMutation()
  const clearMutation = useClearSiteSessionMutation()
  const { mutateAsync: installExtension } = useNativeMessagingInstallExtension()
  const { mutateAsync: removeExtension } = useNativeMessagingRemoveExtension()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<'install' | 'remove' | null>(null)

  const views = data?.views ?? NO_VIEWS

  /** The service answers a refusal with a stable code the renderer can name. */
  const reportError = useCallback(
    (error?: string) => {
      showError(error ? t(`ws_error_${error}`) : t('error_unknown_error'))
    },
    [showError, t]
  )

  const onToggle = useCallback(
    (siteId: string) => {
      const view = views.find((item) => item.siteId === siteId)
      if (!view) return

      void setEnabledMutation
        .mutateAsync({ siteId, enabled: !view.enabled })
        .then((result) => {
          if (!result.success) reportError(result.error)
        })
        .catch(() => {
          // A thrown mutation already reported itself through the toast.
        })
    },
    [reportError, setEnabledMutation, views]
  )

  /**
   * Forgets the sessions the app pulled from Chrome.
   *
   * Only the sites whose import is on are cleared: the session of a site the
   * user signed into inside the app is not ours to throw away.
   */
  const onClearAll = useCallback(() => {
    const importedViews = views.filter((view) => view.enabled)
    if (importedViews.length === 0) return

    void Promise.all(
      importedViews.map((view) =>
        clearMutation
          .mutateAsync({ siteId: view.siteId })
          .then((result) => {
            if (!result.success) reportError(result.error)
          })
          .catch(() => {
            // A thrown mutation already reported itself through the toast.
          })
      )
    )
  }, [clearMutation, reportError, views])

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
    isBusy: setEnabledMutation.isPending || clearMutation.isPending,
    /** Whether there is a session of ours to forget. */
    canClearAll: views.some((view) => view.enabled),
    onToggle,
    onClearAll,
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
