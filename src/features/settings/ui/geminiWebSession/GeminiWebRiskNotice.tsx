import { SettingsSection } from '@shared/ui/components/primitives'
import { CheckIcon, InfoIcon } from '@ui/components/Icons'

interface GeminiWebRiskNoticeProps {
  t: (key: string) => string
  riskItems: string[]
  mitigationItems: string[]
}

function GeminiWebRiskNotice({ t, riskItems, mitigationItems }: GeminiWebRiskNoticeProps) {
  return (
    <SettingsSection
      icon={<InfoIcon className="h-4 w-4" />}
      title={t('gws_warning_title')}
      detail={t('gws_warning_intro')}
    >
      <div className="border-border/60 bg-background/40 flex flex-col gap-5 rounded-xl border p-4">
        <div className="flex flex-col gap-2.5">
          <div className="text-muted-foreground flex items-center gap-2">
            <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold text-amber-600 uppercase dark:text-amber-400">
              {t('gws_risk_list_title')}
            </span>
            <span aria-hidden className="bg-border h-px flex-1" />
          </div>

          <ol className="flex flex-col gap-2">
            {riskItems.map((item, index) => (
              <li key={`risk-${item}`} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="text-ql-11 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-400"
                >
                  {index + 1}
                </span>
                <span className="text-ql-12 text-muted-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-muted-foreground flex items-center gap-2">
            <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold text-emerald-600 uppercase dark:text-emerald-400">
              {t('gws_mitigation_title')}
            </span>
            <span aria-hidden className="bg-border h-px flex-1" />
          </div>

          <ul className="flex flex-col gap-2">
            {mitigationItems.map((item) => (
              <li key={`mitigation-${item}`} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                >
                  <CheckIcon className="h-3 w-3" />
                </span>
                <span className="text-ql-12 text-muted-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-ql-12 text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">{t('gcli_note')}</span>{' '}
          {t('gws_official_warning')}
        </p>
      </div>
    </SettingsSection>
  )
}

export default GeminiWebRiskNotice
