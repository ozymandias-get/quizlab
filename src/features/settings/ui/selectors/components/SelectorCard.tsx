import { motion } from 'framer-motion'
import { normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { AiSelectorConfig, SubmitMode } from '@shared-core/types'
import { getHealthTone } from '../selectorMappings'
import { findSelectorEntry, hasSelectorLocator } from '../selectorUtils'
import type { AiEntry, TranslateFn, ValidationState } from '../types'
import SelectorActionBar from './SelectorActionBar'
import SelectorCardDetails from './SelectorCardDetails'
import SelectorCardHeader from './SelectorCardHeader'
import SelectorValidationPanel from './SelectorValidationPanel'

interface SelectorCardProps {
  aiEntry: AiEntry
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
  onTestSelectors: (aiKey: string, selectorEntry: ReturnType<typeof findSelectorEntry>, cardId: string) => void
  onDeleteSelectors: (hostname: string) => void
  t: TranslateFn
}

export default function SelectorCard({
  aiEntry,
  selectors,
  expandedIds,
  validationState,
  tabs,
  currentAI,
  webviewInstance,
  isSaving,
  isDeleting,
  isTesting,
  onToggleExpanded,
  onOpenRepick,
  onSubmitModeChange,
  onTestSelectors,
  onDeleteSelectors,
  t
}: SelectorCardProps) {
  const { key, ai } = aiEntry
  const cardId = ai.id || key
  const selectorEntry = findSelectorEntry(ai, selectors)
  const selectorConfig = selectorEntry?.config || null
  const hasSelectors = hasSelectorLocator(selectorConfig)
  const selectorHealth = hasSelectors ? selectorConfig?.health || 'ready' : 'missing'
  const tone = getHealthTone(selectorHealth)
  const isExpanded = expandedIds.includes(cardId)
  const validation = validationState[cardId] || { status: 'idle' as const }
  const savedHost =
    selectorEntry?.hostname ||
    selectorConfig?.sourceHostname ||
    selectorConfig?.canonicalHostname ||
    null
  const submitMode = normalizeSubmitMode(selectorConfig?.submitMode) || 'mixed'
  const canTestOnCurrentTab = Boolean(hasSelectors && webviewInstance && currentAI === key)
  const existingTab = tabs.some((tab) => tab.modelId === key)

  return (
    <motion.div
      key={cardId}
      layout
      className={`
        group relative overflow-hidden rounded-[20px] border p-4 pl-5
        transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.05]
        ${tone.border}
      `}
    >
      <SelectorCardHeader
        aiEntry={aiEntry}
        cardId={cardId}
        hasSelectors={hasSelectors}
        savedHost={savedHost}
        selectorHealth={selectorHealth}
        tone={tone}
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
        onOpenRepick={onOpenRepick}
        t={t}
      />

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
          <SelectorCardDetails
            savedHost={savedHost}
            existingTab={existingTab}
            selectorHealth={selectorHealth}
            canTestOnCurrentTab={canTestOnCurrentTab}
            submitMode={submitMode}
            hasSelectors={hasSelectors}
            isSaving={isSaving}
            selectorEntry={selectorEntry}
            onSubmitModeChange={onSubmitModeChange}
            t={t}
          />

          <SelectorValidationPanel validation={validation} t={t} />

          <SelectorActionBar
            hasSelectors={hasSelectors}
            canTestOnCurrentTab={canTestOnCurrentTab}
            isTesting={isTesting}
            validation={validation}
            selectorEntry={selectorEntry}
            isDeleting={isDeleting}
            onTestSelectors={() => onTestSelectors(key, selectorEntry, cardId)}
            onDeleteSelectors={onDeleteSelectors}
            t={t}
          />
        </div>
      )}
    </motion.div>
  )
}
