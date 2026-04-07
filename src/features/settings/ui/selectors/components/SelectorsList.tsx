import type { AiSelectorConfig, SubmitMode } from '@shared-core/types'
import type { AiEntry, SelectorEntry, TranslateFn, ValidationState } from '../types'
import SelectorCard from './SelectorCard'

interface SelectorsListProps {
  aiEntries: AiEntry[]
  selectors: Record<string, AiSelectorConfig>
  expandedIds: string[]
  validationState: Record<string, ValidationState>
  tabs: Array<{ modelId: string }>
  currentAI: string | null
  webviewInstance: unknown
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

export default function SelectorsList(props: SelectorsListProps) {
  const { aiEntries } = props

  return (
    <div className="grid gap-3">
      {aiEntries.map((aiEntry) => (
        <SelectorCard key={aiEntry.ai.id || aiEntry.key} aiEntry={aiEntry} {...props} />
      ))}
    </div>
  )
}
