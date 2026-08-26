import { ocrCache } from '@features/ocr/lib/ocrCache'
import { useOcrStore } from '@features/ocr/store/useOcrStore'
import type { OcrLanguage, OcrQualityPreset, OcrSensitivity } from '@features/ocr/types'

import { Button } from '@app/components/ui/button'
import {
  SettingsRow,
  SettingsRowDescription,
  SettingsRowHeader,
  SettingsRowIcon,
  SettingsRowTitle
} from '@shared/ui/components/primitives'

import { Languages, Layers, ScanSearch, SlidersHorizontal, Trash2 } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import SettingsTabIntro from './shared/SettingsTabIntro'

const OCR_TAB_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
    <ScanSearch className="h-5 w-5" />
  </div>
)

const LANGUAGE_OPTIONS: { value: OcrLanguage; labelKey: string; descKey: string }[] = [
  { value: 'auto', labelKey: 'ocr_language_auto', descKey: 'ocr_language_auto_desc' },
  { value: 'tr', labelKey: 'ocr_language_tr', descKey: 'ocr_language_tr_desc' },
  { value: 'en', labelKey: 'ocr_language_en', descKey: 'ocr_language_en_desc' }
]

const QUALITY_OPTIONS: { value: OcrQualityPreset; labelKey: string; descKey: string }[] = [
  { value: 'fast', labelKey: 'ocr_quality_fast', descKey: 'ocr_quality_fast_desc' },
  { value: 'balanced', labelKey: 'ocr_quality_balanced', descKey: 'ocr_quality_balanced_desc' },
  { value: 'high', labelKey: 'ocr_quality_high', descKey: 'ocr_quality_high_desc' }
]

const SENSITIVITY_OPTIONS: { value: OcrSensitivity; labelKey: string; descKey: string }[] = [
  { value: 'low', labelKey: 'ocr_sensitivity_low', descKey: 'ocr_sensitivity_low_desc' },
  { value: 'medium', labelKey: 'ocr_sensitivity_medium', descKey: 'ocr_sensitivity_medium_desc' },
  { value: 'high', labelKey: 'ocr_sensitivity_high', descKey: 'ocr_sensitivity_high_desc' }
]

const OcrTab = memo(() => {
  const { t } = useTranslation()
  const { language, quality, sensitivity, setConfig } = useOcrStore(
    useShallow((s) => ({
      language: s.config.language,
      quality: s.config.quality,
      sensitivity: s.config.sensitivity,
      setConfig: s.setConfig
    }))
  )

  const handleLanguage = useCallback((v: OcrLanguage) => setConfig({ language: v }), [setConfig])
  const handleQuality = useCallback((v: OcrQualityPreset) => setConfig({ quality: v }), [setConfig])
  const handleSensitivity = useCallback(
    (v: OcrSensitivity) => setConfig({ sensitivity: v }),
    [setConfig]
  )

  const handleClearCache = useCallback(() => {
    ocrCache.clear()
  }, [])

  return (
    <div className="space-y-6">
      <SettingsTabIntro icon={OCR_TAB_ICON} description={t('ocr_settings_description')} />

      {/* Language */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Languages className="text-muted-foreground h-4 w-4" />
          <h3 className="text-ql-12 font-semibold tracking-tight">{t('ocr_language')}</h3>
        </div>
        <p className="text-muted-foreground text-ql-11 px-1 leading-relaxed">
          {t('ocr_language_desc')}
        </p>
        <div className="grid grid-cols-1 gap-2 px-1 sm:grid-cols-3">
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = language === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleLanguage(opt.value)}
                className={`focus-visible:ring-ring/40 flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  active
                    ? 'border-primary/40 bg-muted/80 shadow-xs'
                    : 'bg-card border-border hover:bg-muted/40'
                }`}
              >
                <span className="text-ql-12 font-semibold">{t(opt.labelKey)}</span>
                <span className="text-muted-foreground text-ql-11 leading-snug">
                  {t(opt.descKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quality / Density */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Layers className="text-muted-foreground h-4 w-4" />
          <h3 className="text-ql-12 font-semibold tracking-tight">{t('ocr_quality')}</h3>
        </div>
        <p className="text-muted-foreground text-ql-11 px-1 leading-relaxed">
          {t('ocr_quality_desc')}
        </p>
        <div className="grid grid-cols-1 gap-2 px-1 sm:grid-cols-3">
          {QUALITY_OPTIONS.map((opt) => {
            const active = quality === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleQuality(opt.value)}
                className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-primary/40 bg-muted/80 shadow-xs'
                    : 'bg-card border-border hover:bg-muted/40'
                }`}
              >
                <span className="text-ql-12 font-semibold">{t(opt.labelKey)}</span>
                <span className="text-muted-foreground text-ql-11 leading-snug">
                  {t(opt.descKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sensitivity */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <SlidersHorizontal className="text-muted-foreground h-4 w-4" />
          <h3 className="text-ql-12 font-semibold tracking-tight">{t('ocr_sensitivity')}</h3>
        </div>
        <p className="text-muted-foreground text-ql-11 px-1 leading-relaxed">
          {t('ocr_sensitivity_desc')}
        </p>
        <div className="grid grid-cols-1 gap-2 px-1 sm:grid-cols-3">
          {SENSITIVITY_OPTIONS.map((opt) => {
            const active = sensitivity === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleSensitivity(opt.value)}
                className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-primary/40 bg-muted/80 shadow-xs'
                    : 'bg-card border-border hover:bg-muted/40'
                }`}
              >
                <span className="text-ql-12 font-semibold">{t(opt.labelKey)}</span>
                <span className="text-muted-foreground text-ql-11 leading-snug">
                  {t(opt.descKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Advanced / Cache */}
      <div className="space-y-3">
        <SettingsRow className="shadow-xs">
          <SettingsRowIcon>
            <Trash2 className="h-4 w-4" />
          </SettingsRowIcon>
          <SettingsRowHeader>
            <SettingsRowTitle>{t('ocr_cache')}</SettingsRowTitle>
            <SettingsRowDescription>{t('ocr_cache_desc')}</SettingsRowDescription>
          </SettingsRowHeader>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            className="shrink-0"
          >
            {t('ocr_clear_cache')}
          </Button>
        </SettingsRow>
      </div>

      <div className="border-border bg-muted/20 rounded-xl border p-3">
        <p className="text-ql-11 text-muted-foreground leading-relaxed">{t('ocr_settings_hint')}</p>
      </div>
    </div>
  )
})

OcrTab.displayName = 'OcrTab'

export default OcrTab
