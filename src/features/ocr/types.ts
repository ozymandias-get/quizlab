/**
 * OCR feature — typed models
 * Follows the principle: OCR ON DEMAND — PAGE LEVEL — LAZY LOADED — CACHED — CANCELLABLE — STRUCTURED MARKDOWN/LATEX
 */

export const OCR_CACHE_SCHEMA_VERSION = 1
export const OCR_ENGINE_VERSION = '1.0.0'
export const OCR_MAX_PIXELS = 16_000_000
export const OCR_DEFAULT_SCALE = 2.0
export const OCR_CONCURRENCY = 1
export const OCR_IDLE_TIMEOUT_MS = 5 * 60 * 1000
export const OCR_TIMEOUT_MS = 60_000

export type OcrLanguage = 'auto' | 'tr' | 'en'

export type OcrQualityPreset = 'fast' | 'balanced' | 'high'

export type OcrStatus =
  | 'idle'
  | 'rendering-page'
  | 'initializing-engine'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled'

export interface OcrConfig {
  language: OcrLanguage
  quality: OcrQualityPreset
  forceOcr: boolean
}

export const DEFAULT_OCR_CONFIG: OcrConfig = {
  language: 'auto',
  quality: 'balanced',
  forceOcr: false
}

export interface OcrBlock {
  text: string
  kind: 'paragraph' | 'heading' | 'list-item' | 'table' | 'code' | 'formula' | 'caption'
  bbox?: { x: number; y: number; width: number; height: number }
}

export interface OcrTable {
  headers: string[]
  rows: string[][]
}

export interface OcrFormula {
  latex: string
  display: boolean
  raw: string
}

export interface OcrPageResult {
  pageNumber: number
  documentId: string
  markdown: string
  plainText: string
  language: OcrLanguage
  blocks: OcrBlock[]
  tables: OcrTable[]
  formulas: OcrFormula[]
  engine: string
  engineVersion: string
  createdAt: number
  config: OcrConfig
  isNativeText: boolean
  readingOrder: 'single-column' | 'two-column' | 'unknown'
}

export interface OcrJob {
  id: string
  pageNumber: number
  documentId: string
  documentFingerprint: string
  config: OcrConfig
  signal: AbortSignal
}

export interface OcrState {
  status: OcrStatus
  currentPage: number | null
  currentDocumentId: string | null
  result: OcrPageResult | null
  error: string | null
  isPanelOpen: boolean
}

export interface OcrProviderCapabilities {
  supportsTables: boolean
  supportsFormulas: boolean
  supportsLatex: boolean
  supportsLayout: boolean
  supportedLanguages: OcrLanguage[]
}

export interface OcrProvider {
  readonly name: string
  readonly version: string
  initialize: (config: OcrConfig, signal?: AbortSignal) => Promise<void>
  processPage: (job: OcrJob, imageData: ImageData | Blob | string) => Promise<OcrPageResult>
  dispose: () => Promise<void>
  getCapabilities: () => OcrProviderCapabilities
}

export type OcrCacheKey = string
