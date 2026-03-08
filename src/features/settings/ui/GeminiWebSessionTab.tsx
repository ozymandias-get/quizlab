import React from 'react'
import GeminiWebRiskNotice from './geminiWebSession/GeminiWebRiskNotice'
import GeminiWebSessionOverview from './geminiWebSession/GeminiWebSessionOverview'
import { useGeminiWebSessionState } from './geminiWebSession/useGeminiWebSessionState'

const GeminiWebSessionTab = React.memo(() => {
    const {
        t,
        status,
        reasonText,
        stateText,
        enabledAppIds,
        riskItems,
        mitigationItems,
        actionState,
        handlers
    } = useGeminiWebSessionState()

    return (
        <div className="space-y-6">
            <GeminiWebSessionOverview
                t={t}
                status={status}
                reasonText={reasonText}
                stateText={stateText}
                enabledAppIds={enabledAppIds}
                actionState={actionState}
                handlers={handlers}
            />
            <GeminiWebRiskNotice
                t={t}
                riskItems={riskItems}
                mitigationItems={mitigationItems}
            />
        </div>
    )
})

GeminiWebSessionTab.displayName = 'GeminiWebSessionTab'

export default GeminiWebSessionTab
