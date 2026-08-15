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
      className={`rounded-xl border px-4 py-3 ${
        validation.status === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : validation.status === 'loading'
            ? 'border-primary/30 bg-primary/10'
            : 'border-destructive/30 bg-destructive/10'
      } `}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ql-11 text-muted-foreground font-medium">
          {t('selectors_test_result_label')}
        </span>
        <span
          className={`text-ql-14 font-semibold ${
            validation.status === 'success'
              ? 'text-emerald-600 dark:text-emerald-400'
              : validation.status === 'loading'
                ? 'text-primary'
                : 'text-destructive'
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
          <div className="border-border bg-muted/30 rounded-xl border p-3">
            <p className="text-ql-10 text-muted-foreground font-medium">{t('input_label')}</p>
            <p className="text-ql-13 text-foreground mt-0.5 font-semibold">
              {validation.diagnostics.input.strategy}
            </p>
            <p className="text-ql-12 text-muted-foreground mt-1">
              {validation.diagnostics.input.matchedSelector ||
                validation.diagnostics.input.requestedSelector ||
                t('selectors_no_match')}
            </p>
          </div>

          <div className="border-border bg-muted/30 rounded-xl border p-3">
            <p className="text-ql-10 text-muted-foreground font-medium">{t('picker_el_submit')}</p>
            <p className="text-ql-13 text-foreground mt-0.5 font-semibold">
              {validation.diagnostics.button?.strategy || t('selectors_no_match')}
            </p>
            <p className="text-ql-12 text-muted-foreground mt-1">
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
