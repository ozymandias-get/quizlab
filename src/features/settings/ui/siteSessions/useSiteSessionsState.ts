import type {
  SiteSessionAccountView,
  SiteSessionActionResult,
  SiteSessionSiteView
} from '@shared-core/types/siteSession'

import {
  useNativeMessagingInstallExtension,
  useNativeMessagingRemoveExtension
} from '@platform/electron/api/useNativeMessagingApi'
import {
  useClearSiteSessionMutation,
  useDeleteSiteSessionAccountMutation,
  useRenameSiteSessionAccountMutation,
  useResolveSiteSessionPendingMutation,
  useSetSiteSessionActiveAccountMutation,
  useSetSiteSessionAttributionMutation,
  useSetSiteSessionEnabledMutation,
  useSiteSessionListQuery
} from '@platform/electron/api/useSiteSessionApi'

import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SiteSessionTranslate } from './types'
import { useMitigationItems, useRiskItems } from './wizardContent'

/** The empty list, so the rows keep the same reference between two fetches. */
const NO_VIEWS: SiteSessionSiteView[] = []

/** The account of a site, when the list still holds it. */
function findAccount(
  views: SiteSessionSiteView[],
  siteId: string,
  accountId: string
): SiteSessionAccountView | undefined {
  return views
    .find((view) => view.siteId === siteId)
    ?.accounts.find((account) => account.accountId === accountId)
}

/**
 * The state of the site sessions tab: the accounts of the sites, the actions
 * on them and the extension wizard that sits next to them.
 */
export function useSiteSessionsState() {
  const { t: translate } = useTranslation()
  const t: SiteSessionTranslate = translate
  const { showError, showInfo, showWarning } = useToastActions()
  const { data } = useSiteSessionListQuery()
  const setEnabledMutation = useSetSiteSessionEnabledMutation()
  const clearMutation = useClearSiteSessionMutation()
  const setActiveMutation = useSetSiteSessionActiveAccountMutation()
  const renameMutation = useRenameSiteSessionAccountMutation()
  const deleteMutation = useDeleteSiteSessionAccountMutation()
  const resolvePendingMutation = useResolveSiteSessionPendingMutation()
  const setAttributionMutation = useSetSiteSessionAttributionMutation()
  const { mutateAsync: installExtension } = useNativeMessagingInstallExtension()
  const { mutateAsync: removeExtension } = useNativeMessagingRemoveExtension()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<'install' | 'remove' | null>(null)

  const views = data?.accountViews ?? NO_VIEWS

  /** The service answers a refusal with a stable code the renderer can name. */
  const reportError = useCallback(
    (error?: string) => {
      const message = error ? t(`ws_error_${error}`) : t('error_unknown_error')

      // Some "failures" are not errors: the account was deleted and only its
      // folder stayed behind, or the switch was written and only the session
      // stayed. Neither asks the user to retry the whole action.
      if (error === 'folder_delete_failed') {
        showInfo(message)
        return
      }
      if (error === 'switch_off_wipe_failed') {
        showWarning(message)
        return
      }
      showError(message)
    },
    [showError, showInfo, showWarning, t]
  )

  /**
   * Carries out one account action and tells the user when it did not work.
   *
   * The action may have written part of its change before it failed, so the
   * list is read again whatever the outcome was.
   */
  const runAccountAction = useCallback(
    (action: () => Promise<SiteSessionActionResult>) => {
      void Promise.resolve(action())
        .then((result) => {
          if (result && !result.success) reportError(result.error)
        })
        .catch(() => {
          // A thrown mutation already reported itself through the toast.
        })
    },
    [reportError]
  )

  /**
   * Turns the import of one account on or off.
   *
   * The switch belongs to the account: it says whether the session of *that*
   * account is pulled from Chrome.
   */
  const onToggle = useCallback(
    (siteId: string, accountId: string) => {
      const account = findAccount(views, siteId, accountId)
      if (!account) return

      runAccountAction(() =>
        setEnabledMutation.mutateAsync({ siteId, accountId, enabled: !account.enabled })
      )
    },
    [runAccountAction, setEnabledMutation, views]
  )

  /**
   * Forgets the sessions the app pulled from Chrome.
   *
   * Only the accounts whose import is on are cleared: the session of an
   * account the user signed into inside the app is not ours to throw away.
   */
  const onClearAll = useCallback(() => {
    const enabledAccounts = views.flatMap((view) =>
      view.accounts
        .filter((account) => account.enabled)
        .map((account) => ({ siteId: view.siteId, accountId: account.accountId }))
    )
    if (enabledAccounts.length === 0) return

    for (const { siteId, accountId } of enabledAccounts) {
      runAccountAction(() => clearMutation.mutateAsync({ siteId, accountId }))
    }
  }, [clearMutation, runAccountAction, views])

  /** Marks the account the panels of the site open with. */
  const onSetActive = useCallback(
    (siteId: string, accountId: string) => {
      runAccountAction(() => setActiveMutation.mutateAsync({ siteId, accountId }))
    },
    [runAccountAction, setActiveMutation]
  )

  /** Gives one account the name of the user. */
  const onRename = useCallback(
    (siteId: string, accountId: string, name: string) => {
      runAccountAction(() => renameMutation.mutateAsync({ siteId, accountId, name }))
    },
    [renameMutation, runAccountAction]
  )

  /** Removes one additional account and everything it holds. */
  const onDelete = useCallback(
    (siteId: string, accountId: string) => {
      runAccountAction(() => deleteMutation.mutateAsync({ siteId, accountId }))
    },
    [deleteMutation, runAccountAction]
  )

  /**
   * Writes the session that waits for an account into it.
   *
   * A null account asks for a new one: the session belongs to an account the
   * app does not know yet.
   */
  const onResolvePending = useCallback(
    (siteId: string, accountId: string | null) => {
      runAccountAction(() => resolvePendingMutation.mutateAsync({ siteId, accountId }))
    },
    [resolvePendingMutation, runAccountAction]
  )

  const onReAskAttribution = useCallback(
    (siteId: string) => {
      runAccountAction(() => setAttributionMutation.mutateAsync({ siteId, accountId: null }))
    },
    [runAccountAction, setAttributionMutation]
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
    /** True while an action is on its way to the main process. */
    isBusy:
      setEnabledMutation.isPending ||
      clearMutation.isPending ||
      setActiveMutation.isPending ||
      renameMutation.isPending ||
      deleteMutation.isPending ||
      resolvePendingMutation.isPending ||
      setAttributionMutation.isPending,
    /** Whether there is a session of ours to forget. */
    canClearAll: views.some((view) => view.accounts.some((account) => account.enabled)),
    onToggle,
    onClearAll,
    onSetActive,
    onRename,
    onDelete,
    onResolvePending,
    onReAskAttribution,
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
