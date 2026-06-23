import type { AiSelectorConfig, SubmitMode } from '@shared-core/types'

import { memo } from 'react'

import type { AiEntry, SelectorEntry, TranslateFn, ValidationState } from '../types'
import SelectorCard from './SelectorCard'

interface SelectorsListProps {
  aiEntries: AiEntry[]
  selectors: Record<string, AiSelectorConfig>
  expandedIds: string[]
  validationState: Record<string, ValidationState>
  tabs: Array<{ modelId: string }>
  currentAI: string | null
  hasWebview: boolean
  isSaving: boolean
  isDeleting: boolean
  isTesting: boolean
  onToggleExpanded: (id: string) => void
  onOpenRepick: (aiKey: string, cardId: string) => void
  onSubmitModeChange: (hostname: string, mode: SubmitMode) => void
  onTestSelectors: (aiKey: string, selectorEntry: SelectorEntry | null, cardId: string) => void
  onDeleteSelectors: (hostname: string) => void
  t: TranslateFn
}

export default memo(function SelectorsList(props: SelectorsListProps) {
  const {
    aiEntries,
    expandedIds,
    validationState,
    selectors,
    tabs,
    currentAI,
    hasWebview,
    isSaving,
    isDeleting,
    isTesting,
    onToggleExpanded,
    onOpenRepick,
    onSubmitModeChange,
    onTestSelectors,
    onDeleteSelectors,
    t
  } = props

  return (
    <div className="grid gap-3">
      {aiEntries.map((aiEntry) => {
        const cardId = aiEntry.ai.id || aiEntry.key
        return (
          <SelectorCard
            key={cardId}
            aiEntry={aiEntry}
            cardId={cardId}
            isExpanded={expandedIds.includes(cardId)}
            validation={validationState[cardId] || { status: 'idle' }}
            selectors={selectors}
            tabs={tabs}
            currentAI={currentAI}
            hasWebview={hasWebview}
            isSaving={isSaving}
            isDeleting={isDeleting}
            isTesting={isTesting}
            onToggleExpanded={onToggleExpanded}
            onOpenRepick={onOpenRepick}
            onSubmitModeChange={onSubmitModeChange}
            onTestSelectors={onTestSelectors}
            onDeleteSelectors={onDeleteSelectors}
            t={t}
          />
        )
      })}
    </div>
  )
})
