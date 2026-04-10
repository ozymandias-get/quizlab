import { CheckIcon, ChevronRightIcon, ExternalLinkIcon, GlobeIcon } from '@ui/components/Icons'
import { getAiPlatformIcon, getAiPlatformLabel } from '../../shared/aiPlatformPresentation'
import type { AiEntry, HealthTone, SelectorHealthState, TranslateFn } from '../types'
import { getHealthLabelKey } from '../selectorMappings'

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

export default function SelectorCardHeader({
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
        className="flex min-w-0 flex-1 items-center gap-4 text-left"
      >
        <div className="relative shrink-0">
          <div
            className={`
              rounded-2xl border p-2.5 transition-all duration-300
              ${tone.icon}
            `}
          >
            {getAiPlatformIcon(ai, key, <GlobeIcon className="w-5 h-5" />)}
          </div>

          {hasSelectors && selectorHealth === 'ready' && (
            <div className="absolute -right-1 -top-1 rounded-full border-2 border-[#121212] bg-emerald-500 p-[1px]">
              <CheckIcon className="w-2.5 h-2.5 text-black" strokeWidth={4} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-ql-14 font-bold text-white/90">
              {getAiPlatformLabel(ai, key)}
            </h4>
            <span
              className={`rounded-full border px-2 py-1 text-ql-10 font-medium tracking-ql-fine ${tone.badge}`}
            >
              {t(getHealthLabelKey(selectorHealth))}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-ql-12 text-white/45">
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
          className="
            flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5
            text-sky-300 transition-all hover:border-sky-400/30 hover:bg-sky-500/20 hover:text-sky-200
          "
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" />
          <span className="text-ql-11 font-semibold">{t('selectors_open_repick')}</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleExpanded(cardId)}
          className="rounded-lg border border-white/10 bg-black/10 p-2 text-white/50 transition hover:border-white/20 hover:text-white/80"
          aria-label={isExpanded ? t('ai_send_collapse') : t('ai_send_expand')}
        >
          <ChevronRightIcon
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>
      </div>
    </div>
  )
}
