import type { SubmitMode } from '@shared-core/types'

import { memo } from 'react'

import { SUBMIT_MODE_OPTIONS } from '../constants'
import type { SelectorEntry, SelectorHealthState, TranslateFn } from '../types'

interface SelectorCardDetailsProps {
  savedHost: string | null
  existingTab: boolean
  selectorHealth: SelectorHealthState
  canTestOnCurrentTab: boolean
  submitMode: SubmitMode
  hasSelectors: boolean
  isSaving: boolean
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
  selectorEntry,
  onSubmitModeChange,
  t
}: SelectorCardDetailsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="border-border bg-muted/30 space-y-2 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-ql-10 text-muted-foreground font-medium">
              {t('selectors_saved_host_label')}
            </p>
            <p className="text-ql-13 text-foreground mt-0.5 font-semibold">
              {savedHost || t('selectors_host_unavailable')}
            </p>
          </div>
          {existingTab && (
            <span className="text-ql-10 border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 font-medium">
              {t('selectors_tab_ready')}
            </span>
          )}
        </div>

        {selectorHealth === 'needs_repick' && (
          <p className="text-ql-12 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 leading-relaxed text-amber-700 dark:text-amber-300">
            {t('selectors_repick_warning')}
          </p>
        )}

        {!canTestOnCurrentTab && (
          <p className="text-ql-12 text-muted-foreground leading-relaxed">
            {t('selectors_test_requires_active_tab')}
          </p>
        )}
      </div>

      <div className="border-border bg-muted/30 rounded-xl border p-3">
        <p className="text-ql-10 text-muted-foreground font-medium">
          {t('selectors_submit_mode_label')}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
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
                className={`text-ql-11 rounded-lg border px-3 py-1.5 font-medium transition-colors ${
                  isActive
                    ? 'border-primary/40 bg-primary/15 text-primary font-semibold'
                    : 'border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                } focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {t(option.labelKey)}
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
