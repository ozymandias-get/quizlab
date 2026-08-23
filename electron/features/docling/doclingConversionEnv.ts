import { DOCLING_PIPELINE_LIMITS } from '../../../shared/constants/doclingPipeline.js'
import type { DoclingPipelinePrefs } from '../../../shared/types/quizlabDocument.js'

/**
 * Normalize persisted pipeline prefs into the exact env contract the Python
 * converter expects, applying the shared limit bounds as a final clamp. This
 * is the last line of defence – persisted settings may predate a limit change.
 */
export function buildConverterEnv(prefs: Partial<DoclingPipelinePrefs>): Record<string, string> {
  const bool = (v: unknown): string => (v ? '1' : '0')
  const timeout =
    typeof prefs.documentTimeout === 'number' && prefs.documentTimeout > 0
      ? Math.min(DOCLING_PIPELINE_LIMITS.documentTimeout.max, Math.round(prefs.documentTimeout))
      : null
  const scale =
    typeof prefs.imagesScale === 'number' && Number.isFinite(prefs.imagesScale)
      ? Math.min(
          DOCLING_PIPELINE_LIMITS.imagesScale.max,
          Math.max(DOCLING_PIPELINE_LIMITS.imagesScale.min, prefs.imagesScale)
        )
      : DOCLING_PIPELINE_LIMITS.imagesScale.default

  return {
    DOCLING_DO_OCR: bool(prefs.doOcr),
    DOCLING_OCR_LANG: typeof prefs.ocrLang === 'string' ? prefs.ocrLang : '',
    DOCLING_FORCE_FULL_PAGE_OCR: bool(prefs.forceFullPageOcr),
    DOCLING_EXTRACT_FIGURES: bool(prefs.extractFigures),
    DOCLING_DETECT_TABLES: bool(prefs.detectTables),
    DOCLING_FAST_TABLES: bool(prefs.fastTables),
    DOCLING_CELL_MATCHING: bool(prefs.cellMatching !== false),
    DOCLING_DO_CODE_ENRICHMENT: bool(prefs.doCodeEnrichment),
    DOCLING_DO_FORMULA_ENRICHMENT: bool(prefs.doFormulaEnrichment),
    DOCLING_DO_PICTURE_CLASSIFICATION: bool(prefs.doPictureClassification),
    DOCLING_DO_PICTURE_DESCRIPTION: bool(prefs.doPictureDescription),
    DOCLING_GENERATE_PAGE_IMAGES: bool(prefs.generatePageImages),
    DOCLING_GENERATE_TABLE_IMAGES: bool(prefs.generateTableImages),
    DOCLING_IMAGES_SCALE: String(scale),
    DOCLING_DO_CHART_EXTRACTION: bool(prefs.doChartExtraction),
    DOCLING_FORCE_BACKEND_TEXT: bool(prefs.forceBackendText),
    DOCLING_ENABLE_REMOTE_SERVICES: bool(prefs.enableRemoteServices),
    DOCLING_ALLOW_EXTERNAL_PLUGINS: bool(prefs.allowExternalPlugins),
    DOCLING_DOCUMENT_TIMEOUT: timeout ? String(timeout) : '',
    DOCLING_NUM_THREADS: String(clampInt(prefs.numThreads, DOCLING_PIPELINE_LIMITS.numThreads)),
    // GPU/CUDA was removed from this build; the Python side pins the
    // accelerator to CPU and no device override is forwarded.
    DOCLING_ENABLE_HEADING_HIERARCHY: bool(prefs.enableHeadingHierarchy),
    DOCLING_OCR_BATCH_SIZE: String(
      clampInt(prefs.ocrBatchSize, DOCLING_PIPELINE_LIMITS.ocrBatchSize)
    ),
    DOCLING_LAYOUT_BATCH_SIZE: String(
      clampInt(prefs.layoutBatchSize, DOCLING_PIPELINE_LIMITS.layoutBatchSize)
    ),
    DOCLING_TABLE_BATCH_SIZE: String(
      clampInt(prefs.tableBatchSize, DOCLING_PIPELINE_LIMITS.tableBatchSize)
    ),
    DOCLING_QUEUE_MAX_SIZE: String(
      clampInt(prefs.queueMaxSize, DOCLING_PIPELINE_LIMITS.queueMaxSize)
    ),
    PYTHONUNBUFFERED: '1',
    PYTHONHOME: undefined as unknown as string,
    PYTHONPATH: undefined as unknown as string
  }
}

function clampInt(value: unknown, limit: { min: number; max: number; default: number }): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return limit.default
  return Math.min(limit.max, Math.max(limit.min, Math.round(n)))
}
