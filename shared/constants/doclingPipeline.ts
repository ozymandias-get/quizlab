/**
 * Single source of truth for Docling pipeline preference bounds.
 *
 * The renderer (input min/max attributes), the IPC handler (semantic
 * validation) and the persistent-settings sanitizer (clamping) all read the
 * same numbers from here, so the UI constraint can never drift away from the
 * backend validation boundary.
 */
export interface PipelineNumericLimit {
  min: number
  max: number
  default: number
}

export const DOCLING_PIPELINE_LIMITS = {
  numThreads: { min: 1, max: 16, default: 4 },
  ocrBatchSize: { min: 1, max: 16, default: 4 },
  layoutBatchSize: { min: 1, max: 16, default: 4 },
  tableBatchSize: { min: 1, max: 16, default: 4 },
  queueMaxSize: { min: 10, max: 500, default: 100 },
  imagesScale: { min: 0.5, max: 3, default: 1 },
  /**
   * Docling-level per-document timeout in seconds. `null` means "no Docling
   * timeout". The hard maximum is intentionally below QuizLab's own global
   * conversion cap (15 minutes) so the document timeout always fires first.
   */
  documentTimeout: { min: 30, max: 540 }
} as const satisfies Record<string, PipelineNumericLimit | { min: number; max: number }>

/** QuizLab's hard process-level conversion timeout (ms) – see conversion service. */
export const DOCLING_TASK_TIMEOUT_MS = 15 * 60 * 1000

// 1 = en temel/hızlı, 5 = en detaylı/yavaş. 3 varsayılan (mevcut DEFAULT_PREFS).
export const DOC_PRESET_MIN = 1 as const
export const DOC_PRESET_MAX = 5 as const
export const DOC_PRESET_DEFAULT = 3 as const
export type DocPresetLevel = 1 | 2 | 3 | 4 | 5

export interface DocPresetPatch {
  doOcr: boolean
  extractFigures: boolean
  detectTables: boolean
  fastTables: boolean
  cellMatching: boolean
  doCodeEnrichment: boolean
  doFormulaEnrichment: boolean
  doPictureClassification: boolean
  doPictureDescription: boolean
  doChartExtraction: boolean
  forceBackendText: boolean
  enableHeadingHierarchy: boolean
  imagesScale: number
  forceFullPageOcr: boolean
}

export const DOC_PRESETS: Record<DocPresetLevel, DocPresetPatch> = {
  1: {
    doOcr: false,
    extractFigures: false,
    detectTables: false,
    fastTables: true,
    cellMatching: false,
    doCodeEnrichment: false,
    doFormulaEnrichment: false,
    doPictureClassification: false,
    doPictureDescription: false,
    doChartExtraction: false,
    forceBackendText: false,
    enableHeadingHierarchy: false,
    imagesScale: 1.0,
    forceFullPageOcr: false
  },
  2: {
    doOcr: false,
    extractFigures: false,
    detectTables: true,
    fastTables: true,
    cellMatching: true,
    doCodeEnrichment: false,
    doFormulaEnrichment: false,
    doPictureClassification: false,
    doPictureDescription: false,
    doChartExtraction: false,
    forceBackendText: false,
    enableHeadingHierarchy: false,
    imagesScale: 1.0,
    forceFullPageOcr: false
  },
  3: {
    doOcr: false,
    extractFigures: true,
    detectTables: true,
    fastTables: true,
    cellMatching: true,
    doCodeEnrichment: false,
    doFormulaEnrichment: false,
    doPictureClassification: false,
    doPictureDescription: false,
    doChartExtraction: false,
    forceBackendText: false,
    enableHeadingHierarchy: true,
    imagesScale: 1.0,
    forceFullPageOcr: false
  },
  4: {
    doOcr: true,
    extractFigures: true,
    detectTables: true,
    fastTables: true,
    cellMatching: true,
    doCodeEnrichment: true,
    doFormulaEnrichment: true,
    doPictureClassification: true,
    doPictureDescription: false,
    doChartExtraction: true,
    forceBackendText: false,
    enableHeadingHierarchy: true,
    imagesScale: 1.2,
    forceFullPageOcr: false
  },
  5: {
    doOcr: true,
    extractFigures: true,
    detectTables: true,
    fastTables: false,
    cellMatching: true,
    doCodeEnrichment: true,
    doFormulaEnrichment: true,
    doPictureClassification: true,
    doPictureDescription: true,
    doChartExtraction: true,
    forceBackendText: true,
    enableHeadingHierarchy: true,
    imagesScale: 1.5,
    forceFullPageOcr: false
  }
}

export function getPresetPatch(level: number): DocPresetPatch | null {
  const n = Math.round(level)
  if (n < DOC_PRESET_MIN || n > DOC_PRESET_MAX) return null
  return DOC_PRESETS[n as DocPresetLevel]
}

export function inferPresetLevel(prefs: {
  doOcr?: boolean
  extractFigures?: boolean
  detectTables?: boolean
  fastTables?: boolean
  cellMatching?: boolean
  doCodeEnrichment?: boolean
  doFormulaEnrichment?: boolean
  doPictureClassification?: boolean
  doPictureDescription?: boolean
  doChartExtraction?: boolean
  forceBackendText?: boolean
  enableHeadingHierarchy?: boolean
  imagesScale?: number
  forceFullPageOcr?: boolean
}): DocPresetLevel | null {
  for (let l = DOC_PRESET_MIN; l <= DOC_PRESET_MAX; l += 1) {
    const p = DOC_PRESETS[l as DocPresetLevel]
    let match = true
    for (const k of Object.keys(p) as (keyof DocPresetPatch)[]) {
      const a = (prefs as Record<string, unknown>)[k]
      const b = (p as unknown as Record<string, unknown>)[k]
      if (typeof b === 'number') {
        if (Math.abs((a as number) - (b as number)) > 0.01) {
          match = false
          break
        }
      } else if (a !== b) {
        match = false
        break
      }
    }
    if (match) return l as DocPresetLevel
  }
  return null
}

export type DoclingPipelineLimitKey = keyof typeof DOCLING_PIPELINE_LIMITS

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Clamp an arbitrary incoming value into a limit's range. Returns `fallback`
 * for non-finite input (NaN/Infinity/undefined/strings). Used by both the IPC
 * handler and the settings sanitizer so hostile values cannot pass through.
 */
export function clampPipelineNumber(
  key: Exclude<DoclingPipelineLimitKey, 'documentTimeout'>,
  value: unknown
): number {
  const limit = DOCLING_PIPELINE_LIMITS[key]
  if (!isFiniteNumber(value)) return limit.default
  return Math.min(limit.max, Math.max(limit.min, Math.round(value)))
}

export function clampDocumentTimeout(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null
  if (value <= 0) return null
  const { min, max } = DOCLING_PIPELINE_LIMITS.documentTimeout
  return Math.min(max, Math.max(min, Math.round(value)))
}
