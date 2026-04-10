import { InfoIcon } from '@ui/components/Icons'

interface GeminiWebRiskNoticeProps {
  t: (key: string) => string
  riskItems: string[]
  mitigationItems: string[]
}

function GeminiWebRiskNotice({ t, riskItems, mitigationItems }: GeminiWebRiskNoticeProps) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-rose-500/20 p-1.5">
          <InfoIcon className="h-4 w-4 text-rose-300" />
        </div>
        <div className="flex-1">
          <p className="text-ql-14 font-bold text-rose-100/90">{t('gws_warning_title')}</p>
          <p className="mt-1 text-ql-12 leading-relaxed text-rose-100/70">
            {t('gws_warning_intro')}
          </p>

          <p className="mt-3 text-ql-12 font-bold uppercase tracking-wider text-rose-200/80">
            {t('gws_risk_list_title')}
          </p>
          <div className="mt-1.5 space-y-1.5">
            {riskItems.map((item, index) => (
              <p key={`risk-${index}`} className="text-ql-12 leading-relaxed text-rose-100/70">
                {index + 1}. {item}
              </p>
            ))}
          </div>

          <p className="mt-3 text-ql-12 font-bold uppercase tracking-wider text-rose-200/80">
            {t('gws_mitigation_title')}
          </p>
          <div className="mt-1.5 space-y-1.5">
            {mitigationItems.map((item, index) => (
              <p
                key={`mitigation-${index}`}
                className="text-ql-12 leading-relaxed text-rose-100/70"
              >
                {index + 1}. {item}
              </p>
            ))}
          </div>

          <p className="mt-3 text-ql-12 leading-relaxed text-rose-200/70">
            <strong>{t('gcli_note')}</strong> {t('gws_official_warning')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default GeminiWebRiskNotice
