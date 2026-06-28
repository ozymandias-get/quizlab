import { memo } from 'react'

import type { TranslateFn, ValidationState } from '../types'

interface SelectorValidationPanelProps {
  validation: ValidationState
  t: TranslateFn
}

const SelectorValidationPanel = memo(function SelectorValidationPanel({
  validation,
  t
}: SelectorValidationPanelProps) {
  if (validation.status === 'idle') {
    return null
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        validation.status === 'success'
          ? 'border-emerald-500/20 bg-emerald-500/10'
          : validation.status === 'loading'
            ? 'border-sky-500/20 bg-sky-500/10'
            : 'border-red-500/20 bg-red-500/10'
      } `}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ql-11 tracking-ql-fine font-medium text-white/50">
          {t('selectors_test_result_label')}
        </span>
        <span
          className={`text-ql-14 font-semibold ${
            validation.status === 'success'
              ? 'text-emerald-200'
              : validation.status === 'loading'
                ? 'text-sky-200'
                : 'text-red-200'
          }`}
        >
          {validation.status === 'success'
            ? t('selectors_test_success')
            : validation.status === 'loading'
              ? t('loading')
              : validation.error || t('selectors_test_failed')}
        </span>
      </div>

      {validation.diagnostics && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <p className="text-ql-10 tracking-ql-fine font-medium text-white/38">
              {t('input_label')}
            </p>
            <p className="text-ql-14 mt-1 text-white/80">{validation.diagnostics.input.strategy}</p>
            <p className="text-ql-12 mt-1 text-white/40">
              {validation.diagnostics.input.matchedSelector ||
                validation.diagnostics.input.requestedSelector ||
                t('selectors_no_match')}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <p className="text-ql-10 tracking-ql-fine font-medium text-white/38">
              {t('picker_el_submit')}
            </p>
            <p className="text-ql-14 mt-1 text-white/80">
              {validation.diagnostics.button?.strategy || t('selectors_no_match')}
            </p>
            <p className="text-ql-12 mt-1 text-white/40">
              {validation.diagnostics.button?.matchedSelector ||
                validation.diagnostics.button?.requestedSelector ||
                t('selectors_no_match')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
})
SelectorValidationPanel.displayName = 'SelectorValidationPanel'

export default SelectorValidationPanel
