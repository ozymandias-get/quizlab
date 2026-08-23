import { DOCLING_PIPELINE_LIMITS as LIMITS } from '@shared-core/constants/doclingPipeline'
import type { DoclingPipelinePrefs } from '@shared-core/types'

import { useDoclingPipelineSetPrefs } from '@platform/electron/api/useDoclingPipelineApi'

import {
  Code,
  FileSearch,
  FlaskConical,
  Image as ImageIcon,
  Layers,
  ScanText,
  Server,
  Settings2,
  Table
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DoclingCoreToggles } from './DoclingCoreToggles'
import { PipelineNumberField, PipelineRow } from './PipelineControls'

interface Props {
  prefs: DoclingPipelinePrefs
  busy: boolean
  isInstalled: boolean
}

/**
 * Advanced pipeline options. GPU/device selection was removed from this
 * build (CPU-only runtime) and page/table image generation toggles are not
 * exposed because the Reader does not consume those outputs.
 */
export function DoclingPipelineAdvanced({ prefs, busy, isInstalled }: Props) {
  const { t } = useTranslation()
  const setPrefs = useDoclingPipelineSetPrefs()
  const disabled = busy || !isInstalled

  return (
    <div className="border-border/60 bg-muted/20 mt-3 space-y-4 rounded-xl border p-4">
      <DoclingCoreToggles prefs={prefs} disabled={disabled} />

      <section className="space-y-2">
        <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
          <ScanText className="h-3.5 w-3.5" /> {t('docling_pipeline_group_ocr')}
        </p>
        <div className="space-y-1 pl-1">
          <label className="text-ql-12 flex items-center justify-between gap-2">
            <span>{t('docling_pipeline_ocr_lang')}</span>
            <input
              value={prefs.ocrLang}
              onChange={(e) => setPrefs.mutate({ ocrLang: e.target.value })}
              disabled={disabled}
              placeholder="en,tr"
              className="border-border bg-card text-ql-12 w-28 rounded-md border px-2 py-1"
            />
          </label>
          <PipelineRow
            icon={ScanText}
            title={t('docling_pipeline_force_full_ocr_title')}
            desc={t('docling_pipeline_force_full_ocr_desc')}
            checked={prefs.forceFullPageOcr}
            onChange={(val) => setPrefs.mutate({ forceFullPageOcr: val })}
            disabled={disabled}
          />
          <PipelineNumberField
            label={t('docling_pipeline_ocr_batch')}
            value={prefs.ocrBatchSize}
            min={LIMITS.ocrBatchSize.min}
            max={LIMITS.ocrBatchSize.max}
            onChange={(v) => setPrefs.mutate({ ocrBatchSize: v })}
            disabled={disabled}
          />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
          <FlaskConical className="h-3.5 w-3.5" /> {t('docling_pipeline_group_enrich')}
        </p>
        <PipelineRow
          icon={Code}
          title={t('docling_pipeline_code_title')}
          desc={t('docling_pipeline_code_desc')}
          checked={prefs.doCodeEnrichment}
          onChange={(val) => setPrefs.mutate({ doCodeEnrichment: val })}
          disabled={disabled}
        />
        <PipelineRow
          icon={FlaskConical}
          title={t('docling_pipeline_formula_title')}
          desc={t('docling_pipeline_formula_desc')}
          checked={prefs.doFormulaEnrichment}
          onChange={(val) => setPrefs.mutate({ doFormulaEnrichment: val })}
          disabled={disabled}
        />
        <PipelineRow
          icon={Layers}
          title={t('docling_pipeline_pic_class_title')}
          desc={t('docling_pipeline_pic_class_desc')}
          checked={prefs.doPictureClassification}
          onChange={(val) => setPrefs.mutate({ doPictureClassification: val })}
          disabled={disabled}
        />
        <PipelineRow
          icon={ImageIcon}
          title={t('docling_pipeline_pic_desc_title')}
          desc={t('docling_pipeline_pic_desc_desc')}
          checked={prefs.doPictureDescription}
          onChange={(val) => setPrefs.mutate({ doPictureDescription: val })}
          disabled={disabled}
        />
        <PipelineRow
          icon={ImageIcon}
          title={t('docling_pipeline_chart_title')}
          desc={t('docling_pipeline_chart_desc')}
          checked={prefs.doChartExtraction}
          onChange={(val) => setPrefs.mutate({ doChartExtraction: val })}
          disabled={disabled}
        />
        <PipelineRow
          icon={Table}
          title={t('docling_pipeline_cell_match_title')}
          desc={t('docling_pipeline_cell_match_desc')}
          checked={prefs.cellMatching}
          onChange={(val) => setPrefs.mutate({ cellMatching: val })}
          disabled={disabled}
          disabledReason={!prefs.detectTables ? t('docling_pipeline_cell_match_disabled') : null}
        />
      </section>

      <section className="space-y-2">
        <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
          <ImageIcon className="h-3.5 w-3.5" /> {t('docling_pipeline_group_visual')}
        </p>
        <label className="text-ql-12 flex items-center justify-between gap-2">
          <span>{t('docling_pipeline_images_scale', { x: prefs.imagesScale.toFixed(1) })}</span>
          <input
            type="range"
            min={LIMITS.imagesScale.min}
            max={LIMITS.imagesScale.max}
            step={0.1}
            value={prefs.imagesScale}
            onChange={(e) => setPrefs.mutate({ imagesScale: parseFloat(e.target.value) })}
            disabled={disabled}
            className="w-28"
          />
        </label>
      </section>

      <section className="space-y-2">
        <p className="text-ql-12 flex items-center gap-1.5 font-semibold">
          <Server className="h-3.5 w-3.5" /> {t('docling_pipeline_group_system')}
        </p>
        <PipelineRow
          icon={Server}
          title={t('docling_pipeline_remote_title')}
          desc={t('docling_pipeline_remote_desc')}
          checked={prefs.enableRemoteServices}
          onChange={(val) => setPrefs.mutate({ enableRemoteServices: val })}
          disabled={disabled}
          warning
        />
        <PipelineRow
          icon={Settings2}
          title={t('docling_pipeline_plugins_title')}
          desc={t('docling_pipeline_plugins_desc')}
          checked={prefs.allowExternalPlugins}
          onChange={(val) => setPrefs.mutate({ allowExternalPlugins: val })}
          disabled={disabled}
          warning
        />
        <PipelineRow
          icon={FileSearch}
          title={t('docling_pipeline_backend_text_title')}
          desc={t('docling_pipeline_backend_text_desc')}
          checked={prefs.forceBackendText}
          onChange={(val) => setPrefs.mutate({ forceBackendText: val })}
          disabled={disabled}
        />
        <PipelineRow
          icon={Layers}
          title={t('docling_pipeline_heading_title')}
          desc={t('docling_pipeline_heading_desc')}
          checked={prefs.enableHeadingHierarchy}
          onChange={(val) => setPrefs.mutate({ enableHeadingHierarchy: val })}
          disabled={disabled}
        />
        <div className="grid grid-cols-2 gap-2">
          <PipelineNumberField
            label={t('docling_pipeline_threads')}
            value={prefs.numThreads}
            min={LIMITS.numThreads.min}
            max={LIMITS.numThreads.max}
            onChange={(v) => setPrefs.mutate({ numThreads: v })}
            disabled={disabled}
          />
          <PipelineNumberField
            label={t('docling_pipeline_timeout_label')}
            value={prefs.documentTimeout ?? 0}
            min={0}
            max={LIMITS.documentTimeout.max}
            onChange={(v) => setPrefs.mutate({ documentTimeout: v > 0 ? v : null })}
            disabled={disabled}
          />
          <PipelineNumberField
            label={t('docling_pipeline_queue_max')}
            value={prefs.queueMaxSize}
            min={LIMITS.queueMaxSize.min}
            max={LIMITS.queueMaxSize.max}
            onChange={(v) => setPrefs.mutate({ queueMaxSize: v })}
            disabled={disabled}
          />
          <PipelineNumberField
            label={t('docling_pipeline_layout_batch')}
            value={prefs.layoutBatchSize}
            min={LIMITS.layoutBatchSize.min}
            max={LIMITS.layoutBatchSize.max}
            onChange={(v) => setPrefs.mutate({ layoutBatchSize: v })}
            disabled={disabled}
          />
          <PipelineNumberField
            label={t('docling_pipeline_table_batch')}
            value={prefs.tableBatchSize}
            min={LIMITS.tableBatchSize.min}
            max={LIMITS.tableBatchSize.max}
            onChange={(v) => setPrefs.mutate({ tableBatchSize: v })}
            disabled={disabled}
          />
        </div>
        <p className="text-ql-11 text-muted-foreground">{t('docling_pipeline_timeout_hint')}</p>
        <p className="text-ql-11 text-muted-foreground">{t('docling_pipeline_apply_note')}</p>
      </section>
    </div>
  )
}
