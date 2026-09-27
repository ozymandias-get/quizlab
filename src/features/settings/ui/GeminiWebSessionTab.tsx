import { SettingsTabIcon, SettingsTabIntro } from '@shared/ui/components/primitives'
import { GeminiIcon } from '@ui/components/Icons'

import { memo } from 'react'

import GeminiWebSessionOverview from './geminiWebSession/GeminiWebSessionOverview'
import { useGeminiWebSessionState } from './geminiWebSession/useGeminiWebSessionState'

const GEMINI_WEB_ICON = (
  <SettingsTabIcon>
    <GeminiIcon className="h-5 w-5" />
  </SettingsTabIcon>
)

const GeminiWebSessionTab = memo(() => {
  const {
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
  } = useGeminiWebSessionState()

  return (
    <div className="space-y-6 pb-4">
      <SettingsTabIntro icon={GEMINI_WEB_ICON} description={t('gws_settings_desc')} />

      <GeminiWebSessionOverview
        t={t}
        status={status}
        reasonText={reasonText}
        refreshReasonText={refreshReasonText}
        stateText={stateText}
        enabledAppIds={enabledAppIds}
        actionState={actionState}
        handlers={handlers}
        wizardOpen={wizardOpen}
        wizardMode={wizardMode}
        riskItems={riskItems}
        mitigationItems={mitigationItems}
        closeWizard={closeWizard}
        installExtensionMutation={installExtensionMutation}
        removeExtensionMutation={removeExtensionMutation}
      />
    </div>
  )
})

GeminiWebSessionTab.displayName = 'GeminiWebSessionTab'

export default GeminiWebSessionTab
