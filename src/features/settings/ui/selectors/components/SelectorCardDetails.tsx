import type { AiSelectorConfig, SubmitMode } from '@shared-core/types'

import { memo } from 'react'

import { SUBMIT_MODE_OPTIONS } from '../constants'
import type { SelectorEntry, SelectorHealthState, TranslateFn } from '../types'
import SelectorLocatorHealth from './SelectorLocatorHealth'

interface SelectorCardDetailsProps {
  savedHost: string | null
  existingTab: boolean
  selectorHealth: SelectorHealthState
  canTestOnCurrentTab: boolean
  submitMode: SubmitMode
  hasSelectors: boolean
  isSaving: boolean
  selectorConfig: AiSelectorConfig | null
  selectorEntry: SelectorEntry | null
  onSubmitModeChange: (hostname: string, mode: SubmitMode) => void
  t: TranslateFn
}

const SelectorCardDetails = memo(function SelectorCardDetails({
  savedHost,
  existingTab,
  selectorHealth,
  canTestOnCurrentTab,
  submitMode,
  hasSelectors,
  isSaving,
  selectorConfig,
  selectorEntry,
  onSubmitModeChange,
  t
}: SelectorCardDetailsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="border-border/60 bg-background/40 flex flex-col gap-2 rounded-xl border p-4">
        <div className="text-muted-foreground flex items-center gap-2">
          <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold uppercase">
            {t('selectors_saved_host_label')}
          </span>
          <span aria-hidden className="bg-border h-px flex-1" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-ql-13 text-foreground truncate font-semibold">
            {savedHost || t('selectors_host_unavailable')}
          </span>
          {existingTab && (
            <span className="text-ql-10 border-border/60 bg-muted text-muted-foreground shrink-0 rounded-full border px-2 py-0.5 font-medium">
              {t('selectors_tab_ready')}
            </span>
          )}
        </div>

        {selectorHealth === 'needs_repick' && (
          <p className="text-ql-12 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 leading-relaxed text-amber-600 dark:text-amber-400">
            {t('selectors_repick_warning')}
          </p>
        )}

        {!canTestOnCurrentTab && (
          <p className="text-ql-12 text-muted-foreground leading-relaxed">
            {t('selectors_test_requires_active_tab')}
          </p>
        )}
      </div>

      <SelectorLocatorHealth config={selectorConfig} t={t} />

      <div className="border-border/60 bg-background/40 flex flex-col gap-2 rounded-xl border p-4 md:col-span-2">
        <div className="text-muted-foreground flex items-center gap-2">
          <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold uppercase">
            {t('selectors_submit_mode_label')}
          </span>
          <span aria-hidden className="bg-border h-px flex-1" />
        </div>

        <div className="flex flex-wrap gap-2">
          {SUBMIT_MODE_OPTIONS.map((option) => {
            const isActive = submitMode === option.value
            return (
              <button
                key={option.value}
                type="button"
                disabled={!hasSelectors || isSaving}
                aria-pressed={isActive}
                onClick={() =>
                  selectorEntry && onSubmitModeChange(selectorEntry.hostname, option.value)
                }
                className={`focus-visible:ring-ring/40 rounded-lg border px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                  isActive
                    ? 'border-ring/50 bg-accent/30'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <span
                  className={`text-ql-12 ${isActive ? 'text-foreground font-semibold' : 'font-medium'}`}
                >
                  {t(option.labelKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})
SelectorCardDetails.displayName = 'SelectorCardDetails'

export default SelectorCardDetails
