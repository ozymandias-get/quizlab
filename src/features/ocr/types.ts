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

export type OcrSensitivity = 'low' | 'medium' | 'high'

export type OcrStatus =
  | 'idle'
  | 'rendering-page'
  | 'initializing-engine'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled'

export type OcrOutcome =
  | 'success'
  | 'noText'
  | 'engineUnavailable'
  | 'cancelled'
  | 'timeout'
  | 'error'

export type OcrErrorCode =
  | 'PAGE_RENDER_FAILED'
  | 'TESSERACT_NOT_AVAILABLE'
  | 'NO_TEXT_RECOGNIZED'
  | 'OCR_FAILED'
  | 'NO_NATIVE_TEXT'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'STALE'

export class OcrError extends Error {
  code: OcrErrorCode
  constructor(code: OcrErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'OcrError'
    this.code = code
  }
}

export interface OcrConfig {
  language: OcrLanguage
  quality: OcrQualityPreset
  sensitivity: OcrSensitivity
  forceOcr: boolean
}

export const DEFAULT_OCR_CONFIG: OcrConfig = {
  language: 'auto',
  quality: 'balanced',
  sensitivity: 'medium',
  forceOcr: false
}

/**
 * Quality preset → render config mapping
 * Ensures preset actually changes pipeline behaviour instead of being a no-op.
 */
export interface OcrRenderPreset {
  scale: number
  maxPixels: number
  useDirectPdfRender: boolean
}

export const OCR_QUALITY_PRESETS: Record<OcrQualityPreset, OcrRenderPreset> = {
  fast: { scale: 1.25, maxPixels: 6_000_000, useDirectPdfRender: false },
  balanced: { scale: 2.0, maxPixels: 12_000_000, useDirectPdfRender: true },
  high: { scale: 2.8, maxPixels: 16_000_000, useDirectPdfRender: true }
}

export function getRenderPreset(quality: OcrQualityPreset): OcrRenderPreset {
  return OCR_QUALITY_PRESETS[quality] ?? OCR_QUALITY_PRESETS.balanced
}

/**
 * Sensitivity preset → thresholds used for native-text decision and confidence gating
 */
export interface OcrSensitivityPreset {
  nativeMinChars: number
  nativeMinBlocks: number
  confidenceThreshold: number
}

export const OCR_SENSITIVITY_PRESETS: Record<OcrSensitivity, OcrSensitivityPreset> = {
  low: { nativeMinChars: 10, nativeMinBlocks: 1, confidenceThreshold: 30 },
  medium: { nativeMinChars: 50, nativeMinBlocks: 2, confidenceThreshold: 55 },
  high: { nativeMinChars: 120, nativeMinBlocks: 3, confidenceThreshold: 75 }
}

export function getSensitivityPreset(sensitivity: OcrSensitivity): OcrSensitivityPreset {
  return OCR_SENSITIVITY_PRESETS[sensitivity] ?? OCR_SENSITIVITY_PRESETS.medium
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
  outcome?: OcrOutcome
  confidence?: number
}

export interface OcrJob {
  id: string
  pageNumber: number
  documentId: string
  documentFingerprint: string
  config: OcrConfig
  signal: AbortSignal
  /** Distinguish page-level OCR vs region/area OCR — region must never fallback to full-page native text */
  kind?: 'page' | 'region'
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
  /** Optional region-specific processing — if implemented, region jobs should use this and never fallback to native page text */
  processRegion?: (job: OcrJob, imageData: ImageData | Blob | string) => Promise<OcrPageResult>
  dispose: () => Promise<void>
  getCapabilities: () => OcrProviderCapabilities
}

export type OcrCacheKey = string
