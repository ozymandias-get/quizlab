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
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <h3 id={titleId} className="text-ql-16 font-semibold text-white">
          {t('gws_extension_wizard_risk_title')}
        </h3>
      </div>
      <p className="text-ql-13 text-white/50">{t('gws_extension_wizard_risk_desc')}</p>

      <div className="mt-5 flex flex-col gap-3">
        <p className="text-ql-12 font-medium text-amber-400/80">
          {t('gws_extension_wizard_risk_list_title')}
        </p>
        {riskItems.map((item, i) => (
          <div key={item} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-400">
              {i + 1}
            </span>
            <span className="text-ql-13 text-white/70">{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <p className="text-ql-12 font-medium text-emerald-400/80">
          {t('gws_extension_wizard_mitigation_title')}
        </p>
        {mitigationItems.map((item) => (
          <div key={`mit-${item}`} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="text-ql-13 text-white/70">{item}</span>
          </div>
        ))}
      </div>

      <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-colors hover:border-white/20">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          className="h-4 w-4 rounded border-white/30 bg-white/10 text-emerald-400 focus:ring-emerald-400/60 focus:ring-offset-0"
        />
        <span className="text-ql-13 text-white/70">{t('gws_extension_wizard_confirm_label')}</span>
      </label>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="text-ql-13 rounded-full px-5 py-2.5 font-medium text-white/60 transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
        >
          {t('gws_extension_wizard_cancel_btn')}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!confirmed}
          className="text-ql-13 inline-flex items-center justify-center rounded-full bg-emerald-400/90 px-6 py-2.5 font-semibold text-white transition-all hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('gws_extension_wizard_next_btn')}
        </button>
      </div>
    </div>
  )
}

export default memo(RiskStepContent)
