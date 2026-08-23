import path from 'node:path'

import type { DoclingPipelinePrefs } from '@shared-core/types'

import { app } from 'electron'

import { ConfigManager as CM } from '../../core/ConfigManager.js'

export type { DoclingPipelinePrefs }

const DEFAULT_PREFS: DoclingPipelinePrefs = {
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
  extractFigures: false,
  generatePageImages: false,
  generateTableImages: false,
  imagesScale: 1.0,
  doChartExtraction: false,
  forceBackendText: false,
  enableRemoteServices: false,
  allowExternalPlugins: false,
  documentTimeout: null,
  numThreads: 4,
  device: 'auto',
  enableHeadingHierarchy: false,
  ocrBatchSize: 4,
  layoutBatchSize: 4,
  tableBatchSize: 4,
  queueMaxSize: 100
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
  return { ...DEFAULT_PREFS, ...data }
}

export async function setPipelinePrefs(
  patch: Partial<DoclingPipelinePrefs>
): Promise<DoclingPipelinePrefs> {
  const cur = await getPipelinePrefs()
  const next: DoclingPipelinePrefs = { ...cur, ...patch, updatedAt: Date.now() }
  const clean: DoclingPipelinePrefs = {
    doOcr: !!next.doOcr,
    ocrLang: typeof next.ocrLang === 'string' ? next.ocrLang : '',
    forceFullPageOcr: !!next.forceFullPageOcr,
    detectTables: !!next.detectTables,
    fastTables: !!next.fastTables,
    cellMatching: next.cellMatching !== false,
    doCodeEnrichment: !!next.doCodeEnrichment,
    doFormulaEnrichment: !!next.doFormulaEnrichment,
    doPictureClassification: !!next.doPictureClassification,
    doPictureDescription: !!next.doPictureDescription,
    extractFigures: !!next.extractFigures,
    generatePageImages: !!next.generatePageImages,
    generateTableImages: !!next.generateTableImages,
    imagesScale:
      typeof next.imagesScale === 'number' && next.imagesScale >= 0.5 && next.imagesScale <= 3
        ? next.imagesScale
        : 1.0,
    doChartExtraction: !!next.doChartExtraction,
    forceBackendText: !!next.forceBackendText,
    enableRemoteServices: !!next.enableRemoteServices,
    allowExternalPlugins: !!next.allowExternalPlugins,
    documentTimeout:
      typeof next.documentTimeout === 'number' && next.documentTimeout > 0
        ? next.documentTimeout
        : null,
    numThreads:
      typeof next.numThreads === 'number' && next.numThreads >= 1 && next.numThreads <= 16
        ? Math.round(next.numThreads)
        : 4,
    device: ['auto', 'cpu', 'cuda', 'mps'].includes(next.device) ? next.device : 'auto',
    enableHeadingHierarchy: !!next.enableHeadingHierarchy,
    ocrBatchSize:
      typeof next.ocrBatchSize === 'number' && next.ocrBatchSize >= 1
        ? Math.round(next.ocrBatchSize)
        : 4,
    layoutBatchSize:
      typeof next.layoutBatchSize === 'number' && next.layoutBatchSize >= 1
        ? Math.round(next.layoutBatchSize)
        : 4,
    tableBatchSize:
      typeof next.tableBatchSize === 'number' && next.tableBatchSize >= 1
        ? Math.round(next.tableBatchSize)
        : 4,
    queueMaxSize:
      typeof next.queueMaxSize === 'number' && next.queueMaxSize >= 10
        ? Math.round(next.queueMaxSize)
        : 100,
    updatedAt: next.updatedAt
  }
  await getManager().write(clean)
  return clean
}

export function pipelinePrefsHash(prefs: DoclingPipelinePrefs): string {
  return [
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
    prefs.device,
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
