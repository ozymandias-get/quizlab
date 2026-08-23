import { DOC_PRESETS, inferPresetLevel } from '@shared-core/constants/doclingPipeline'

import {
  useDoclingPipelinePrefs,
  useDoclingPipelineSetPrefs
} from '@platform/electron/api/useDoclingPipelineApi'

import { SurfaceCard } from '@shared/ui/components/primitives'

import { ChevronDown, RotateCcw } from 'lucide-react'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DoclingPipelineAdvanced } from './DoclingPipelineAdvanced'

interface Props {
  isInstalled: boolean
}

const DoclingPipelineCard = memo(function DoclingPipelineCard({ isInstalled }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const { t } = useTranslation()
  const { data: prefs, isLoading } = useDoclingPipelinePrefs()
  const setPrefs = useDoclingPipelineSetPrefs()
  const busy = setPrefs.isPending || isLoading

  if (isLoading || !prefs) {
    return (
      <SurfaceCard className="p-5">
        <p className="text-ql-13 text-muted-foreground">{t('docling_pipeline_loading')}</p>
      </SurfaceCard>
    )
  }

  const currentLevel = (prefs.presetLevel as 1 | 2 | 3 | 4 | 5) ?? inferPresetLevel(prefs) ?? 3

  const applyPreset = (level: 1 | 2 | 3 | 4 | 5) => {
    const patch = DOC_PRESETS[level]
    setPrefs.mutate({ presetLevel: level, ...patch })
  }

  return (
    <SurfaceCard className="space-y-3 p-5">
      <div className="mb-2">
        <h3 className="text-ql-13 font-semibold">{t('docling_pipeline_title')}</h3>
        <p className="text-ql-11 text-muted-foreground">{t('docling_pipeline_subtitle')}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-ql-12 font-medium">{t('docling_preset_label')}</span>
          <span className="text-ql-11 text-muted-foreground">
            {t(`docling_preset_${currentLevel}_title`)} · {currentLevel}/5
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => applyPreset(n as 1 | 2 | 3 | 4 | 5)}
              disabled={busy || !isInstalled}
              className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                currentLevel === n
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card hover:bg-muted text-foreground'
              } ${busy || !isInstalled ? 'opacity-50' : ''}`}
            >
              <span className="text-ql-13 font-bold">{n}</span>
            </button>
          ))}
        </div>
        <div className="bg-muted/30 border-border/50 rounded-lg border px-3 py-2">
          <p className="text-ql-12 font-medium">{t(`docling_preset_${currentLevel}_title`)}</p>
          <p className="text-ql-11 text-muted-foreground leading-snug">
            {t(`docling_preset_${currentLevel}_desc`)}
          </p>
        </div>
        <p className="text-ql-11 text-muted-foreground">{t('docling_preset_hint')}</p>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="text-ql-12 text-muted-foreground hover:text-foreground mt-3 flex w-full items-center justify-between rounded-lg border border-dashed px-3 py-2"
      >
        <span>{t('docling_pipeline_advanced')}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {advancedOpen && (
        <>
          <DoclingPipelineAdvanced prefs={prefs} busy={busy} isInstalled={isInstalled} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyPreset(3)}
              disabled={busy || !isInstalled}
              className="text-ql-12 border-border bg-card hover:bg-muted flex items-center gap-1.5 rounded-md border px-3 py-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              {t('docling_pipeline_reset')}
            </button>
          </div>
        </>
      )}
    </SurfaceCard>
  )
})

export default DoclingPipelineCard
