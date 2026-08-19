import { Button } from '@app/components/ui/button'
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
            <h4 className="text-ql-14 text-foreground truncate font-semibold">
              {getAiPlatformLabel(ai, key)}
            </h4>
            <span
              className={`text-ql-10 rounded-full border px-2 py-0.5 font-medium ${tone.badge}`}
            >
              {t(getHealthLabelKey(selectorHealth))}
            </span>
          </div>
          <div className="text-ql-12 text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
            <span>{hasSelectors ? t('selectors_active') : t('no_selectors')}</span>
            {savedHost && (
              <span className="text-muted-foreground/60">
                {t('selectors_saved_host', { host: savedHost })}
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenRepick(key, cardId)}
          className="gap-1.5"
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" />
          <span className="text-ql-11 font-semibold">{t('selectors_open_repick')}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onToggleExpanded(cardId)}
          aria-label={isExpanded ? t('ai_send_collapse') : t('ai_send_expand')}
        >
          <ChevronRightIcon
            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </Button>
      </div>
    </div>
  )
})
SelectorCardHeader.displayName = 'SelectorCardHeader'

export default SelectorCardHeader
