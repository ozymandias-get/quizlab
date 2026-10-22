import { Button, SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'
import { GlobeIcon, XIcon } from '@ui/components/Icons'

import { memo, useCallback, useMemo } from 'react'

import { ExtensionStatusCard, ExtensionWizardPanel } from './components'
import SiteSessionList from './SiteSessionList'
import SiteSessionRiskNotice from './SiteSessionRiskNotice'
import type { SiteSessionActions } from './types'
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
    onSetActive,
    onRename,
    onDelete,
    onResolvePending,
    riskItems,
    mitigationItems,
    wizardOpen,
    wizardMode,
    openWizard,
    closeWizard,
    installExtension,
    removeExtension
  } = useSiteSessionsState()

  // The rows take the actions as one object, so it keeps its reference
  // between two renders of the tab.
  const actions: SiteSessionActions = useMemo(
    () => ({ onToggle, onSetActive, onRename, onDelete, onResolvePending }),
    [onDelete, onRename, onResolvePending, onSetActive, onToggle]
  )

  const handleInstall = useCallback(async () => {
    const result = await installExtension()
    return result ?? { success: false, error: t('error_unknown_error') }
  }, [installExtension, t])

  const handleRemove = useCallback(async () => {
    const result = await removeExtension()
    return result ?? { success: false, error: t('error_unknown_error') }
  }, [removeExtension, t])

  return (
    <div className="space-y-6 pb-4">
      <SettingsTabIntro icon={SITE_SESSIONS_ICON} description={t('ws_settings_desc')} />

      <ExtensionStatusCard
        t={t}
        onInstallExtension={() => openWizard('install')}
        onRemoveExtension={() => openWizard('remove')}
      />

      <SiteSessionRiskNotice t={t} riskItems={riskItems} mitigationItems={mitigationItems} />

      <p className="text-ql-12 text-muted-foreground leading-relaxed">{t('ws_toggle_hint')}</p>

      <SiteSessionList views={views} disabled={isBusy} actions={actions} t={t} />

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
      </div>

      {wizardOpen && wizardMode && (
        <ExtensionWizardPanel
          open={wizardOpen}
          mode={wizardMode}
          riskItems={riskItems}
          mitigationItems={mitigationItems}
          installedPath={null}
          onInstall={handleInstall}
          onRemove={handleRemove}
          onClose={closeWizard}
        />
      )}
    </div>
  )
})

/**
 * Every visited tab stays mounted, so the memo keeps the rows of this tab
 * still while the modal re-renders for another tab.
 */
SiteSessionsTab.displayName = 'SiteSessionsTab'

export default SiteSessionsTab
