import { CheckIcon, ChevronRightIcon, ExternalLinkIcon, GlobeIcon } from '@ui/components/Icons'

import { memo } from 'react'

import { getAiPlatformIcon, getAiPlatformLabel } from '../../shared/aiPlatformPresentation'
import { getHealthLabelKey } from '../selectorMappings'
import type { AiEntry, HealthTone, SelectorHealthState, TranslateFn } from '../types'

interface SelectorCardHeaderProps {
  aiEntry: AiEntry
  cardId: string
  hasSelectors: boolean
  savedHost: string | null
  selectorHealth: SelectorHealthState
  tone: HealthTone
  isExpanded: boolean
  onToggleExpanded: (id: string) => void
  onOpenRepick: (aiKey: string, cardId: string) => void
  t: TranslateFn
}

const SelectorCardHeader = memo(function SelectorCardHeader({
  aiEntry,
  cardId,
  hasSelectors,
  savedHost,
  selectorHealth,
  tone,
  isExpanded,
  onToggleExpanded,
  onOpenRepick,
  t
}: SelectorCardHeaderProps) {
  const { key, ai } = aiEntry

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onToggleExpanded(cardId)}
        aria-expanded={isExpanded}
        className="focus-visible:ring-ring ring-offset-background flex min-w-0 flex-1 items-center gap-4 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <div className="relative shrink-0">
          <div className={`rounded-2xl border p-2.5 transition-colors duration-300 ${tone.icon} `}>
            {getAiPlatformIcon(ai, key, <GlobeIcon className="h-5 w-5" />)}
          </div>

          {hasSelectors && selectorHealth === 'ready' && (
            <div className="absolute -top-1 -right-1 rounded-full border-2 border-[var(--color-bg-primary,#121212)] bg-emerald-500 p-[1px]">
              <CheckIcon className="h-2.5 w-2.5 text-black" strokeWidth={4} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-ql-14 truncate font-bold text-white/90">
              {getAiPlatformLabel(ai, key)}
            </h4>
            <span
              className={`text-ql-10 tracking-ql-fine rounded-full border px-2 py-1 font-medium ${tone.badge}`}
            >
              {t(getHealthLabelKey(selectorHealth))}
            </span>
          </div>
          <div className="text-ql-12 mt-1 flex flex-wrap items-center gap-2 text-white/45">
            <span>{hasSelectors ? t('selectors_active') : t('no_selectors')}</span>
            {savedHost && (
              <span className="text-white/30">
                {t('selectors_saved_host', { host: savedHost })}
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenRepick(key, cardId)}
          className="ring-offset-background flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-sky-300 transition-colors hover:border-sky-400/30 hover:bg-sky-500/20 hover:text-sky-200 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" />
          <span className="text-ql-11 font-semibold">{t('selectors_open_repick')}</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleExpanded(cardId)}
          className="focus-visible:ring-ring ring-offset-background rounded-lg border border-white/10 bg-black/10 p-2 text-white/50 transition hover:border-white/20 hover:text-white/80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label={isExpanded ? t('ai_send_collapse') : t('ai_send_expand')}
        >
          <ChevronRightIcon
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>
      </div>
    </div>
  )
})
SelectorCardHeader.displayName = 'SelectorCardHeader'

export default SelectorCardHeader
