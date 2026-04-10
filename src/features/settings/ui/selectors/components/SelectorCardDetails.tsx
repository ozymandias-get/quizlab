import { normalizeSubmitMode } from '@shared-core/selectorConfig'
import type { SubmitMode } from '@shared-core/types'
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

export default function SelectorCardDetails({
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
  const currentSubmitMode = normalizeSubmitMode(submitMode) || 'mixed'

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-2 rounded-2xl border border-white/[0.06] bg-black/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-ql-10 font-medium tracking-ql-fine text-white/38">
              {t('selectors_saved_host_label')}
            </p>
            <p className="mt-1 text-ql-14 text-white/80">
              {savedHost || t('selectors_host_unavailable')}
            </p>
          </div>
          {existingTab && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-ql-10 font-medium tracking-ql-fine text-white/45">
              {t('selectors_tab_ready')}
            </span>
          )}
        </div>

        {selectorHealth === 'needs_repick' && (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-ql-12 leading-relaxed text-amber-100">
            {t('selectors_repick_warning')}
          </p>
        )}

        {!canTestOnCurrentTab && (
          <p className="text-ql-12 leading-relaxed text-white/40">
            {t('selectors_test_requires_active_tab')}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-3">
        <p className="text-ql-10 font-medium tracking-ql-fine text-white/38">
          {t('selectors_submit_mode_label')}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUBMIT_MODE_OPTIONS.map((option) => {
            const isActive = currentSubmitMode === option.value
            return (
              <button
                key={option.value}
                type="button"
                disabled={!hasSelectors || isSaving}
                aria-pressed={isActive}
                onClick={() =>
                  selectorEntry && onSubmitModeChange(selectorEntry.hostname, option.value)
                }
                className={`
                  rounded-full border px-3 py-1.5 text-ql-11 font-medium transition
                  ${
                    isActive
                      ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/80'
                  }
                  disabled:cursor-not-allowed disabled:opacity-45
                `}
              >
                {t(option.labelKey)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
