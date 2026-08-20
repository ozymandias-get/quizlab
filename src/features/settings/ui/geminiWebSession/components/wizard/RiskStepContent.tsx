import { Button } from '@app/components/ui/button'

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
        <h3 id={titleId} className="text-ql-15 text-foreground font-semibold">
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
        <Button type="button" variant="outline" onClick={onClose} className="text-ql-12">
          {t('gws_extension_wizard_cancel_btn')}
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!confirmed}
          className="text-ql-12 shadow-xs"
        >
          {t('gws_extension_wizard_next_btn')}
        </Button>
      </div>
    </div>
  )
}

export default memo(RiskStepContent)
