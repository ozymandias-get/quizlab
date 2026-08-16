import { AlertTriangle, Check } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface RiskStepContentProps {
  confirmed: boolean
  onConfirmedChange: (checked: boolean) => void
  onNext: () => void
  onClose: () => void
  riskItems: string[]
  mitigationItems: string[]
  titleId: string
}

function RiskStepContent({
  confirmed,
  onConfirmedChange,
  onNext,
  onClose,
  riskItems,
  mitigationItems,
  titleId
}: RiskStepContentProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col px-8 pt-4 pb-8 text-left">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <h3 id={titleId} className="text-ql-16 text-foreground font-semibold">
          {t('gws_extension_wizard_risk_title')}
        </h3>
      </div>
      <p className="text-ql-13 text-muted-foreground">{t('gws_extension_wizard_risk_desc')}</p>

      <div className="mt-5 flex flex-col gap-3">
        <p className="text-ql-12 font-semibold text-amber-600 dark:text-amber-400">
          {t('gws_extension_wizard_risk_list_title')}
        </p>
        {riskItems.map((item, i) => (
          <div key={item} className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-600 dark:text-amber-400">
              {i + 1}
            </span>
            <span className="text-ql-13 text-foreground">{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <p className="text-ql-12 font-semibold text-emerald-600 dark:text-emerald-400">
          {t('gws_extension_wizard_mitigation_title')}
        </p>
        {mitigationItems.map((item) => (
          <div key={`mit-${item}`} className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" />
            </span>
            <span className="text-ql-13 text-foreground">{item}</span>
          </div>
        ))}
      </div>

      <label className="border-border bg-muted/40 hover:bg-muted mt-6 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          className="border-border text-primary focus-visible:ring-ring h-4 w-4 rounded focus-visible:ring-offset-0"
        />
        <span className="text-ql-13 text-foreground font-medium">
          {t('gws_extension_wizard_confirm_label')}
        </span>
      </label>

      <div className="mt-6 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="text-ql-12 border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-lg border px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_cancel_btn')}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!confirmed}
          className="text-ql-12 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 inline-flex items-center justify-center rounded-lg px-5 py-2 font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('gws_extension_wizard_next_btn')}
        </button>
      </div>
    </div>
  )
}

export default memo(RiskStepContent)
