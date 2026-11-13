import { normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { AiSelectorConfig, SubmitMode } from '@shared-core/types'

import { DURATION } from '@shared/lib/motion'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'

import { getHealthTone } from '../selectorMappings'
import { findSelectorEntry, hasSelectorLocator } from '../selectorUtils'
import type { AiEntry, TranslateFn, ValidationState } from '../types'
import SelectorActionBar from './SelectorActionBar'
import SelectorCardDetails from './SelectorCardDetails'
import SelectorCardHeader from './SelectorCardHeader'
import SelectorValidationPanel from './SelectorValidationPanel'

interface SelectorCardProps {
  aiEntry: AiEntry
  cardId: string
  isExpanded: boolean
  validation: ValidationState
  selectors: Record<string, AiSelectorConfig>
  tabs: Array<{ modelId: string }>
  currentAI: string | null
  hasContent: boolean
  isSaving: boolean
  isDeleting: boolean
  isTesting: boolean
  onToggleExpanded: (id: string) => void
  onOpenRepick: (aiKey: string, cardId: string) => void
  onSubmitModeChange: (hostname: string, mode: SubmitMode) => void
  onTestSelectors: (
    aiKey: string,
    selectorEntry: ReturnType<typeof findSelectorEntry>,
    cardId: string
  ) => void
  onDeleteSelectors: (hostname: string) => void
  t: TranslateFn
}

/** Same easing as the home accordions (`AiHomeSection`, prompt disclosures). */
const ACCORDION_EASE = [0.4, 0, 0.2, 1] as const

export default memo(function SelectorCard({
  aiEntry,
  cardId,
  isExpanded,
  validation,
  selectors,
  tabs,
  currentAI,
  hasContent,
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
  const prefersReducedMotion = useReducedMotion()
  const selectorEntry = findSelectorEntry(ai, selectors)
  const selectorConfig = selectorEntry?.config || null
  const hasSelectors = hasSelectorLocator(selectorConfig)
  const selectorHealth = hasSelectors ? selectorConfig?.health || 'ready' : 'missing'
  const tone = getHealthTone(selectorHealth)
  const savedHost =
    selectorEntry?.hostname ||
    selectorConfig?.sourceHostname ||
    selectorConfig?.canonicalHostname ||
    null
  const submitMode = normalizeSubmitMode(selectorConfig?.submitMode) || 'mixed'
  const canTestOnCurrentTab = Boolean(hasSelectors && hasContent && currentAI === key)
  const existingTab = tabs.some((tab) => tab.modelId === key)

  const panelTransition = {
    duration: prefersReducedMotion ? 0 : DURATION.slow,
    ease: ACCORDION_EASE
  }

  return (
    /* No `layout` here: Framer's projection scaled the whole card (header and
       text included) while the body mounted, which is what made the accordion
       look squashed. The body's own height animation moves the siblings. */
    <div
      className={`group relative overflow-hidden rounded-xl border p-4 transition-colors ${tone.border} `}
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

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="selector-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={panelTransition}
            className="overflow-hidden will-change-[height,opacity]"
          >
            <div className="mt-4 flex flex-col border-t border-white/[0.07] pt-4">
              <SelectorCardDetails
                savedHost={savedHost}
                existingTab={existingTab}
                selectorHealth={selectorHealth}
                canTestOnCurrentTab={canTestOnCurrentTab}
                submitMode={submitMode}
                hasSelectors={hasSelectors}
                isSaving={isSaving}
                selectorConfig={selectorConfig}
                selectorEntry={selectorEntry}
                onSubmitModeChange={onSubmitModeChange}
                t={t}
              />

              {/* A test result can appear while the card is already open. It
                  gets its own height+margin transition so the action bar slides
                  instead of jumping; `initial={false}` keeps a card that is
                  reopened with a stored result from re-animating. */}
              <AnimatePresence initial={false}>
                {validation.status !== 'idle' && (
                  <motion.div
                    key="validation"
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={panelTransition}
                    className="overflow-hidden"
                  >
                    <SelectorValidationPanel validation={validation} t={t} />
                  </motion.div>
                )}
              </AnimatePresence>

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
                className="mt-4"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
