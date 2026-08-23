import type { DoclingPipelinePrefs } from '@shared-core/types'

import { useDoclingPipelineSetPrefs } from '@platform/electron/api/useDoclingPipelineApi'

import { Image as ImageIcon, Layers, ScanText, Table, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PipelineRow } from './PipelineControls'

interface Props {
  prefs: DoclingPipelinePrefs
  disabled: boolean
}

export function DoclingCoreToggles({ prefs, disabled }: Props) {
  const { t } = useTranslation()
  const setPrefs = useDoclingPipelineSetPrefs()
  return (
    <section className="space-y-1">
      <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
        <Layers className="h-3.5 w-3.5" /> {t('docling_pipeline_group_core')}
      </p>
      <PipelineRow
        icon={ScanText}
        title={t('docling_pipeline_ocr_title')}
        desc={t('docling_pipeline_ocr_desc')}
        checked={prefs.doOcr}
        onChange={(val) => setPrefs.mutate({ doOcr: val })}
        disabled={disabled}
      />
      <PipelineRow
        icon={ImageIcon}
        title={t('docling_pipeline_figures_title')}
        desc={t('docling_pipeline_figures_desc')}
        checked={prefs.extractFigures}
        onChange={(val) => setPrefs.mutate({ extractFigures: val })}
        disabled={disabled}
      />
      <PipelineRow
        icon={Table}
        title={t('docling_pipeline_tables_title')}
        desc={t('docling_pipeline_tables_desc')}
        checked={prefs.detectTables}
        onChange={(val) => setPrefs.mutate({ detectTables: val })}
        disabled={disabled}
      />
      <PipelineRow
        icon={Zap}
        title={t('docling_pipeline_fast_tables_title')}
        desc={t('docling_pipeline_fast_tables_desc')}
        checked={prefs.fastTables}
        onChange={(val) => setPrefs.mutate({ fastTables: val })}
        disabled={disabled}
        disabledReason={!prefs.detectTables ? t('docling_pipeline_fast_tables_disabled') : null}
      />
    </section>
  )
}
