/**
 * QuizLabDocument — normalized document model.
 *
 * This is the single source of truth for the Reader UI. No UI component
 * may depend on a converter-specific format (Docling, MinerU, …). Every
 * converter goes through an adapter:
 *
 *   Docling JSON ──► DoclingAdapter ──► QuizLabDocument ──► Reader UI
 *   MinerU  JSON ──► MinerUAdapter  ──► QuizLabDocument ──┘
 *
 * The model preserves all information needed for faithful rendering and
 * provenance (page, bbox, reading order) without leaking converter internals.
 */

export type QuizLabBlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'table'
  | 'list'
  | 'list_item'
  | 'formula'
  | 'caption'
  | 'code'
  | 'footnote'
  | 'unknown'

export interface QuizLabBbox {
  l: number
  t: number
  r: number
  b: number
  coordOrigin?: 'BOTTOMLEFT' | 'TOPLEFT' | string
}

export interface QuizLabProvenance {
  pageNumber: number
  bbox: QuizLabBbox
  charspan?: [number, number]
}

export interface QuizLabBlockBase {
  id: string
  type: QuizLabBlockType
  pageNumber: number
  bbox?: QuizLabBbox
  prov: QuizLabProvenance[]
  readingOrder: number
  parentId?: string | null
  childrenIds?: string[]
  metadata?: Record<string, unknown>
}

export interface QuizLabHeadingBlock extends QuizLabBlockBase {
  type: 'heading'
  level: number
  text: string
}

export interface QuizLabParagraphBlock extends QuizLabBlockBase {
  type: 'paragraph'
  text: string
}

export interface QuizLabImageBlock extends QuizLabBlockBase {
  type: 'image'
  caption?: string | null
  alt?: string | null
  assetId?: string | null
  assetUrl?: string | null
  width?: number | null
  height?: number | null
}

export interface QuizLabTableCell {
  text: string
  rowSpan?: number
  colSpan?: number
  bbox?: QuizLabBbox
  isHeader?: boolean
}

export interface QuizLabTableBlock extends QuizLabBlockBase {
  type: 'table'
  caption?: string | null
  rows: QuizLabTableCell[][]
  html?: string | null
  assetId?: string | null
}

export interface QuizLabListBlock extends QuizLabBlockBase {
  type: 'list'
  ordered: boolean
  items: string[]
}

export interface QuizLabListItemBlock extends QuizLabBlockBase {
  type: 'list_item'
  text: string
  ordered: boolean
  index: number
}

export interface QuizLabFormulaBlock extends QuizLabBlockBase {
  type: 'formula'
  text: string
  latex?: string | null
}

export interface QuizLabCaptionBlock extends QuizLabBlockBase {
  type: 'caption'
  text: string
  forBlockId?: string | null
}

export interface QuizLabCodeBlock extends QuizLabBlockBase {
  type: 'code'
  text: string
  language?: string | null
}

export interface QuizLabUnknownBlock extends QuizLabBlockBase {
  type: 'unknown'
  rawText?: string | null
}

export type QuizLabBlock =
  | QuizLabHeadingBlock
  | QuizLabParagraphBlock
  | QuizLabImageBlock
  | QuizLabTableBlock
  | QuizLabListBlock
  | QuizLabListItemBlock
  | QuizLabFormulaBlock
  | QuizLabCaptionBlock
  | QuizLabCodeBlock
  | QuizLabUnknownBlock

export interface QuizLabPage {
  pageNumber: number
  width: number
  height: number
  dpi?: number | null
}

export interface QuizLabDocument {
  id: string
  title: string | null
  source: {
    pdfPath: string
    pdfName: string
    fileSize?: number | null
    fileHash?: string | null
  }
  pageCount: number
  pages: QuizLabPage[]
  blocks: QuizLabBlock[]
  metadata: {
    converter: {
      name: 'docling' | 'mineru' | string
      version: string
    }
    createdAt: number
    conversionTimeMs: number | null
    readingOrderSource: 'docling_body' | 'page_order' | string
  }
}

// Conversion task model for async Docling processing
export type QuizLabConversionStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type QuizLabConversionErrorCode =
  | 'unsupported_pdf'
  | 'encrypted_pdf'
  | 'corrupted_pdf'
  | 'scanned_pdf_no_text'
  | 'ocr_failure'
  | 'conversion_timeout'
  | 'docling_crash'
  | 'not_installed'
  | 'service_unavailable'
  | 'model_missing'
  | 'cancelled'
  | 'unknown'

export interface QuizLabConversionError {
  code: QuizLabConversionErrorCode
  message: string
  details?: string | null
}

export interface QuizLabConversionTask {
  taskId: string
  pdfPath: string
  status: QuizLabConversionStatus
  progress?: {
    phase: string
    percent: number | null
    message?: string | null
  } | null
  error?: QuizLabConversionError | null
  createdAt: number
  updatedAt: number
}

export interface QuizLabDocumentResult {
  taskId: string
  document: QuizLabDocument | null
  error?: QuizLabConversionError | null
}

export interface DoclingPipelinePrefs {
  // Preset level 1 (minimal) .. 5 (max). Stored to remember user choice; actual
  // pipeline fields are materialised from the preset when the user picks a level.
  presetLevel: number
  // Core
  doOcr: boolean
  ocrLang: string
  forceFullPageOcr: boolean
  detectTables: boolean
  fastTables: boolean
  cellMatching: boolean
  // Enrichments
  doCodeEnrichment: boolean
  doFormulaEnrichment: boolean
  doPictureClassification: boolean
  doPictureDescription: boolean
  extractFigures: boolean
  generatePageImages: boolean
  generateTableImages: boolean
  imagesScale: number
  doChartExtraction: boolean
  // Backend / behaviour
  forceBackendText: boolean
  enableRemoteServices: boolean
  allowExternalPlugins: boolean
  documentTimeout: number | null
  // Performance
  numThreads: number
  enableHeadingHierarchy: boolean
  ocrBatchSize: number
  layoutBatchSize: number
  tableBatchSize: number
  queueMaxSize: number
  updatedAt?: number
}
