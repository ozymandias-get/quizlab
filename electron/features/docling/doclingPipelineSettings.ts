import path from 'node:path'

import { app } from 'electron'

import {
  clampDocumentTimeout,
  clampPipelineNumber,
  DOCLING_PIPELINE_LIMITS,
  inferPresetLevel
} from '../../../shared/constants/doclingPipeline.js'
import type { DoclingPipelinePrefs } from '../../../shared/types/quizlabDocument.js'
import { ConfigManager as CM } from '../../core/ConfigManager.js'

export type { DoclingPipelinePrefs }

const DEFAULT_PREFS: DoclingPipelinePrefs = {
  presetLevel: 3,
  doOcr: false,
  ocrLang: '',
  forceFullPageOcr: false,
  detectTables: true,
  fastTables: true,
  cellMatching: true,
  doCodeEnrichment: false,
  doFormulaEnrichment: false,
  doPictureClassification: false,
  doPictureDescription: false,
  extractFigures: true,
  generatePageImages: false,
  generateTableImages: false,
  imagesScale: DOCLING_PIPELINE_LIMITS.imagesScale.default,
  doChartExtraction: false,
  forceBackendText: false,
  enableRemoteServices: false,
  allowExternalPlugins: false,
  documentTimeout: null,
  numThreads: DOCLING_PIPELINE_LIMITS.numThreads.default,
  enableHeadingHierarchy: true,
  ocrBatchSize: DOCLING_PIPELINE_LIMITS.ocrBatchSize.default,
  layoutBatchSize: DOCLING_PIPELINE_LIMITS.layoutBatchSize.default,
  tableBatchSize: DOCLING_PIPELINE_LIMITS.tableBatchSize.default,
  queueMaxSize: DOCLING_PIPELINE_LIMITS.queueMaxSize.default
}

function getPipelineConfigPath(): string {
  return path.join(app.getPath('userData'), 'components', 'docling', 'pipeline.json')
}

let manager: CM<DoclingPipelinePrefs> | null = null
function getManager(): CM<DoclingPipelinePrefs> {
  if (!manager) manager = new CM<DoclingPipelinePrefs>(getPipelineConfigPath())
  return manager
}

export async function getPipelinePrefs(): Promise<DoclingPipelinePrefs> {
  const data = await getManager().read()
  // Persisted files may predate schema changes (e.g. removed keys); strip
  // anything unknown so callers only ever see the current shape.
  return sanitize(data)
}

/**
 * Central sanitizer – the single validation boundary for persisted prefs.
 * The IPC handler type-checks incoming patches and delegates here, so
 * renderer constraints and backend limits can never drift apart.
 */
export function sanitize(input: Partial<DoclingPipelinePrefs>): DoclingPipelinePrefs {
  const next: DoclingPipelinePrefs = { ...DEFAULT_PREFS, ...input }
  // Reader does not consume page/table images – force false even if the
  // persisted file still carries a user-enabled `true` (P1-5 migration). Keep
  // the fields in the persisted shape for back-compat but never run them.
  ;(next as unknown as Record<string, unknown>).generatePageImages = false
  ;(next as unknown as Record<string, unknown>).generateTableImages = false
  // P1-5: VLM picture description requires optional models-vlm-inline extra;
  // disable until VLM component manager is implemented.
  ;(next as unknown as Record<string, unknown>).doPictureDescription = false
  // P1-6: RapidOCR single-language; sanitize comma-list to first entry
  if (typeof next.ocrLang === 'string' && next.ocrLang.includes(',')) {
    next.ocrLang = next.ocrLang.split(',')[0]!.trim()
  }

  // P1-7: if the pipeline fields no longer match any preset, store `null`
  // so the UI can show “Özel”. `inferPresetLevel` checks exactly the 14
  // preset-controlled fields; changes to non-preset fields (e.g. threads,
  // ocrLang) keep the preset badge.
  const inferred = inferPresetLevel(next as unknown as Parameters<typeof inferPresetLevel>[0])
  let level: number | null
  if (inferred !== null) {
    level = inferred
  } else {
    // No preset matches → custom. For first-run (empty persisted file) the
    // inferred for DEFAULT_PREFS is 3, so we never fall here for fresh installs.
    // For legacy data where the persisted presetLevel was numeric but the
    // fields now diverge (e.g. old 2==3), treat as custom.
    level = null
    // Fresh install with no persisted data: input is {} → next is DEFAULT_PREFS
    // which *does* match a preset (see above), so this branch is not taken.
    // As a safety net, if inferred is null and input was empty, default to 3.
    if (Object.keys(input).length === 0) level = 3
  }
  return {
    presetLevel: level as DoclingPipelinePrefs['presetLevel'],
    doOcr: !!next.doOcr,
    ocrLang: typeof next.ocrLang === 'string' ? next.ocrLang.slice(0, 64) : '',
    forceFullPageOcr: !!next.forceFullPageOcr,
    detectTables: !!next.detectTables,
    fastTables: !!next.fastTables,
    cellMatching: next.cellMatching !== false,
    doCodeEnrichment: !!next.doCodeEnrichment,
    doFormulaEnrichment: !!next.doFormulaEnrichment,
    doPictureClassification: !!next.doPictureClassification,
    doPictureDescription: !!next.doPictureDescription,
    extractFigures: !!next.extractFigures,
    generatePageImages: false,
    generateTableImages: false,
    imagesScale:
      typeof next.imagesScale === 'number' &&
      next.imagesScale >= DOCLING_PIPELINE_LIMITS.imagesScale.min &&
      next.imagesScale <= DOCLING_PIPELINE_LIMITS.imagesScale.max
        ? next.imagesScale
        : DOCLING_PIPELINE_LIMITS.imagesScale.default,
    doChartExtraction: !!next.doChartExtraction,
    forceBackendText: !!next.forceBackendText,
    enableRemoteServices: !!next.enableRemoteServices,
    allowExternalPlugins: !!next.allowExternalPlugins,
    documentTimeout: clampDocumentTimeout(next.documentTimeout),
    numThreads: clampPipelineNumber('numThreads', next.numThreads),
    enableHeadingHierarchy: !!next.enableHeadingHierarchy,
    ocrBatchSize: clampPipelineNumber('ocrBatchSize', next.ocrBatchSize),
    layoutBatchSize: clampPipelineNumber('layoutBatchSize', next.layoutBatchSize),
    tableBatchSize: clampPipelineNumber('tableBatchSize', next.tableBatchSize),
    queueMaxSize: clampPipelineNumber('queueMaxSize', next.queueMaxSize),
    updatedAt: Date.now()
  }
}

export async function setPipelinePrefs(
  patch: Partial<DoclingPipelinePrefs>
): Promise<DoclingPipelinePrefs> {
  const cur = await getPipelinePrefs()
  const clean = sanitize({ ...cur, ...patch })
  await getManager().write(clean)
  return clean
}

export function pipelinePrefsHash(prefs: DoclingPipelinePrefs): string {
  return [
    prefs.presetLevel,
    prefs.doOcr ? 1 : 0,
    prefs.ocrLang,
    prefs.forceFullPageOcr ? 1 : 0,
    prefs.detectTables ? 1 : 0,
    prefs.fastTables ? 1 : 0,
    prefs.cellMatching ? 1 : 0,
    prefs.doCodeEnrichment ? 1 : 0,
    prefs.doFormulaEnrichment ? 1 : 0,
    prefs.doPictureClassification ? 1 : 0,
    prefs.doPictureDescription ? 1 : 0,
    prefs.extractFigures ? 1 : 0,
    prefs.generatePageImages ? 1 : 0,
    prefs.generateTableImages ? 1 : 0,
    prefs.imagesScale,
    prefs.doChartExtraction ? 1 : 0,
    prefs.forceBackendText ? 1 : 0,
    prefs.enableRemoteServices ? 1 : 0,
    prefs.allowExternalPlugins ? 1 : 0,
    prefs.documentTimeout ?? 0,
    prefs.numThreads,
    prefs.enableHeadingHierarchy ? 1 : 0,
    prefs.ocrBatchSize,
    prefs.layoutBatchSize,
    prefs.tableBatchSize,
    prefs.queueMaxSize
  ].join('-')
}

export function resetPipelineManagerForTests(): void {
  manager = null
}

export const PIPELINE_PREFS_DEFAULTS = DEFAULT_PREFS
