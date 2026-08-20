import { GeminiIcon } from '@ui/components/Icons'

import { memo } from 'react'

import GeminiWebRiskNotice from './geminiWebSession/GeminiWebRiskNotice'
import GeminiWebSessionOverview from './geminiWebSession/GeminiWebSessionOverview'
import { useGeminiWebSessionState } from './geminiWebSession/useGeminiWebSessionState'
import SettingsTabIntro from './shared/SettingsTabIntro'

const GEMINI_WEB_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
    <GeminiIcon className="h-5 w-5" />
  </div>
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
    <div className="space-y-6">
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
      <GeminiWebRiskNotice t={t} riskItems={riskItems} mitigationItems={mitigationItems} />
    </div>
  )
})

GeminiWebSessionTab.displayName = 'GeminiWebSessionTab'

export default GeminiWebSessionTab
