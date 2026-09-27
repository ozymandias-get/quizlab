import type { AutomationSelectorDiagnostics } from '@shared-core/types'

import { memo } from 'react'

import type { TranslateFn, ValidationState } from '../types'

interface SelectorValidationPanelProps {
  validation: ValidationState
  t: TranslateFn
}

interface SelectorDiagnosticTileProps {
  labelKey: string
  diagnostics: AutomationSelectorDiagnostics | undefined
  t: TranslateFn
}

/**
 * One locator's resolution summary. Besides the raw strategy (still useful for
 * debugging) it surfaces the two signals that actually explain a surprise:
 * whether the element was *recovered* rather than found directly, and how
 * confident the scoring was. Both come from the injected diagnostics, so nothing
 * extra is executed.
 */
const SelectorDiagnosticTile = memo(function SelectorDiagnosticTile({
  labelKey,
  diagnostics,
  t
}: SelectorDiagnosticTileProps) {
  return (
    <div className="border-border/60 bg-background/40 flex flex-col gap-1 rounded-xl border p-4">
      <p className="text-muted-foreground text-ql-10 tracking-ql-label font-semibold uppercase">
        {t(labelKey)}
      </p>
      <p className="text-ql-13 text-foreground font-semibold">
        {diagnostics?.strategy || t('selectors_no_match')}
      </p>
      <p className="text-ql-12 text-muted-foreground break-all">
        {diagnostics?.matchedSelector || diagnostics?.requestedSelector || t('selectors_no_match')}
      </p>
      {diagnostics && (
        <p className="text-ql-11 text-muted-foreground">
          {t(
            diagnostics.recovered ? 'selectors_resolution_recovered' : 'selectors_resolution_direct'
          )}
          {diagnostics.confidenceLevel
            ? ` · ${t(`selectors_confidence_${diagnostics.confidenceLevel}`)}`
            : ''}
        </p>
      )}
    </div>
  )
})
SelectorDiagnosticTile.displayName = 'SelectorDiagnosticTile'

const SelectorValidationPanel = memo(function SelectorValidationPanel({
  validation,
  t
}: SelectorValidationPanelProps) {
  if (validation.status === 'idle') {
    return null
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
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
          className={`text-ql-13 font-semibold ${
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
        <div className="grid gap-3 md:grid-cols-2">
          <SelectorDiagnosticTile
            labelKey="input_label"
            diagnostics={validation.diagnostics.input}
            t={t}
          />

          <SelectorDiagnosticTile
            labelKey="picker_el_submit"
            diagnostics={validation.diagnostics.button}
            t={t}
          />
        </div>
      )}
    </div>
  )
})
SelectorValidationPanel.displayName = 'SelectorValidationPanel'

export default SelectorValidationPanel
