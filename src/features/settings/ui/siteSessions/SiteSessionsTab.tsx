import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { Button, SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'
import { GlobeIcon, XIcon } from '@ui/components/Icons'

import { memo } from 'react'

import { ExtensionPairingDialog, ExtensionStatusCard } from './components'
import SiteSessionList from './SiteSessionList'
import SiteSessionRiskNotice from './SiteSessionRiskNotice'
import { useSiteSessionsState } from './useSiteSessionsState'

const SITE_SESSIONS_ICON = (
  <SettingsTabIcon>
    <GlobeIcon className="h-5 w-5" />
  </SettingsTabIcon>
)

/**
 * The per-site session tab.
 *
 * The extension status comes first, because nothing works without it; the
 * risk notice explains what the feature does; the list is what the user came
 * for.
 */
const SiteSessionsTab = memo(() => {
  const {
    t,
    views,
    isBusy,
    canClearAll,
    onToggle,
    onClearAll,
    onRetryFailedClear,
    failedClearSites,
    confirmProps,
    riskItems,
    mitigationItems,
    pairingOpen,
    openPairing,
    closePairing
  } = useSiteSessionsState()

  return (
    <div className="space-y-6 pb-4">
      <SettingsTabIntro icon={SITE_SESSIONS_ICON} description={t('ws_settings_desc')} />

      <ExtensionStatusCard t={t} onShowPairing={openPairing} />

      <SiteSessionRiskNotice t={t} riskItems={riskItems} mitigationItems={mitigationItems} />

      <p className="text-ql-12 text-muted-foreground leading-relaxed">{t('ws_toggle_hint')}</p>

      <SiteSessionList views={views} disabled={isBusy} onToggle={onToggle} t={t} />

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-start">
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            onClick={onClearAll}
            disabled={isBusy || !canClearAll}
            className="gap-2"
          >
            <XIcon className="h-4 w-4" />
            <span className="text-ql-12 font-semibold">{t('ws_clear_all_btn')}</span>
          </Button>
        </div>

        <p className="text-ql-11 text-muted-foreground leading-relaxed">{t('ws_clear_all_hint')}</p>

        {failedClearSites.length > 0 && (
          <div
            role="status"
            className="border-destructive/30 bg-destructive/5 mt-2 flex flex-col gap-2 rounded-lg border p-3"
          >
            <p className="text-ql-12 text-destructive leading-relaxed">
              {t('ws_clear_all_failed_notice', {
                count: String(failedClearSites.length),
                sites: failedClearSites.map((view) => t(view.labelKey)).join(', ')
              })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onRetryFailedClear()}
              disabled={isBusy}
              className="self-start"
            >
              <span className="text-ql-11 font-semibold">{t('ws_clear_all_retry_btn')}</span>
            </Button>
          </div>
        )}
      </div>

      <ExtensionPairingDialog open={pairingOpen} onClose={closePairing} />

      <ConfirmDialog {...confirmProps} />
    </div>
  )
})

/**
 * Every visited tab stays mounted, so the memo keeps the rows of this tab
 * still while the modal re-renders for another tab.
 */
SiteSessionsTab.displayName = 'SiteSessionsTab'

export default SiteSessionsTab
