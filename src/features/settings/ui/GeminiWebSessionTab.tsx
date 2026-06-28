import { memo } from 'react'

import GeminiWebRiskNotice from './geminiWebSession/GeminiWebRiskNotice'
import GeminiWebSessionOverview from './geminiWebSession/GeminiWebSessionOverview'
import { useGeminiWebSessionState } from './geminiWebSession/useGeminiWebSessionState'

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
