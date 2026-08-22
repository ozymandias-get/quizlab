import { randomUUID } from 'node:crypto'

import type {
  QuizLabBbox,
  QuizLabBlock,
  QuizLabDocument,
  QuizLabPage,
  QuizLabProvenance
} from '../../../shared/types/quizlabDocument.js'
import { DOCLING_VERSION } from './doclingVersions.js'

interface DoclingBbox {
  l: number
  t: number
  r: number
  b: number
  coord_origin?: string
}

interface DoclingProv {
  page_no: number
  bbox: DoclingBbox
  charspan?: [number, number]
}

interface DoclingRef {
  $ref: string
}

type DoclingLabel =
  | 'title'
  | 'section_header'
  | 'page_header'
  | 'page_footer'
  | 'text'
  | 'paragraph'
  | 'list_item'
  | 'caption'
  | 'code'
  | 'formula'
  | 'footnote'
  | 'table'
  | 'picture'
  | string

interface DoclingTextItem {
  text: string
  label: DoclingLabel
  prov?: DoclingProv[]
  orig?: string
  level?: number
  // table-specific
  data?: unknown
  // image
  image?: { uri?: string; dpi?: number }
}

interface DoclingDocumentRaw {
  name?: string
  origin?: { mimetype?: string; binary_hash?: string; filename?: string }
  body?: { children?: DoclingRef[] }
  texts?: DoclingTextItem[]
  pictures?: DoclingTextItem[]
  tables?: DoclingTextItem[]
  pages?: Array<{ page_no: number; size?: { width: number; height: number }; dpi?: number }>
  // Some exports wrap in `document` key
  document?: DoclingDocumentRaw
}

function toQuizLabBbox(b: DoclingBbox): QuizLabBbox {
  return { l: b.l, t: b.t, r: b.r, b: b.b, coordOrigin: b.coord_origin }
}

function toQuizLabProv(prov: DoclingProv[]): QuizLabProvenance[] {
  return prov.map((p) => ({
    pageNumber: p.page_no,
    bbox: toQuizLabBbox(p.bbox),
    charspan: p.charspan
  }))
}

function primaryPage(prov?: DoclingProv[]): number {
  if (!prov || prov.length === 0) return 1
  return prov[0]?.page_no ?? 1
}

function primaryBbox(prov?: DoclingProv[]): QuizLabBbox | undefined {
  if (!prov || prov.length === 0) return undefined
  return toQuizLabBbox(prov[0].bbox)
}

function labelToBlockType(
  label: DoclingLabel,
  text: string
): { type: QuizLabBlock['type']; level?: number } {
  const l = label?.toLowerCase() ?? ''
  if (l === 'title' || l === 'section_header') {
    // Heuristic level from orig markdown or default 1
    return { type: 'heading', level: 1 }
  }
  if (l === 'page_header' || l === 'page_footer') return { type: 'paragraph', level: undefined }
  if (l === 'list_item') return { type: 'list_item' }
  if (l === 'caption') return { type: 'caption' }
  if (l === 'code') return { type: 'code' }
  if (l === 'formula') return { type: 'formula' }
  if (l === 'footnote') return { type: 'unknown' }
  if (l === 'table') return { type: 'table' }
  if (l === 'picture') return { type: 'image' }
  // Fallback: detect list-like text
  if (/^\s*[\d•\-*]\s+/.test(text)) return { type: 'list_item' }
  return { type: 'paragraph' }
}

function buildRefMap(raw: DoclingDocumentRaw): Map<string, DoclingTextItem & { _kind: string }> {
  const map = new Map<string, DoclingTextItem & { _kind: string }>()
  const push = (arr: DoclingTextItem[] | undefined, kind: string, base: string) => {
    if (!arr) return
    for (const [idx, item] of arr.entries()) {
      map.set(`#/${base}/${idx}`, { ...item, _kind: kind })
    }
  }
  push(raw.texts, 'texts', 'texts')
  push(raw.pictures, 'pictures', 'pictures')
  push(raw.tables, 'tables', 'tables')
  // Some docling versions use `body` children that reference `texts` etc., but also have `groups`
  return map
}

function normalizeDoclingRaw(input: unknown): DoclingDocumentRaw {
  if (!input || typeof input !== 'object') return {}
  const obj = input as Record<string, unknown>
  // Unwrap { document: {...} } if present
  if (obj.document && typeof obj.document === 'object') {
    return normalizeDoclingRaw(obj.document)
  }
  return obj as unknown as DoclingDocumentRaw
}

export interface AdaptOptions {
  pdfPath: string
  pdfName?: string
  fileSize?: number | null
  fileHash?: string | null
  docId?: string
  conversionTimeMs?: number | null
}

export function adaptDoclingToQuizLabDocument(
  rawInput: unknown,
  options: AdaptOptions
): QuizLabDocument {
  const raw = normalizeDoclingRaw(rawInput)
  const docId = options.docId ?? randomUUID()
  const now = Date.now()

  const refMap = buildRefMap(raw)
  const orderRefs: DoclingRef[] = raw.body?.children ?? []

  // Fallback order: all texts/pictures/tables in the order they appear
  const fallbackRefs: DoclingRef[] =
    orderRefs.length > 0
      ? orderRefs
      : [
          ...(raw.texts ?? []).map((_, i) => ({ $ref: `#/texts/${i}` }) as DoclingRef),
          ...(raw.pictures ?? []).map((_, i) => ({ $ref: `#/pictures/${i}` }) as DoclingRef),
          ...(raw.tables ?? []).map((_, i) => ({ $ref: `#/tables/${i}` }) as DoclingRef)
        ]

  const blocks: QuizLabBlock[] = []
  let readingOrder = 0

  for (const ref of fallbackRefs) {
    const item = refMap.get(ref.$ref)
    if (!item) continue

    const text = (item.text ?? item.orig ?? '').trim()
    // Skip empty text blocks unless they are images/tables
    if (
      !text &&
      item._kind !== 'pictures' &&
      item._kind !== 'tables' &&
      item.label !== 'picture' &&
      item.label !== 'table'
    ) {
      // Still create paragraph with empty? No, skip to avoid noise
      if (text.length === 0) continue
    }

    const prov = item.prov ?? []
    const pageNumber = primaryPage(prov)
    const bbox = primaryBbox(prov)
    const base = {
      id: randomUUID(),
      pageNumber,
      bbox,
      prov: toQuizLabProv(prov),
      readingOrder: readingOrder++,
      parentId: null as string | null,
      childrenIds: [] as string[],
      metadata: {
        doclingRef: ref.$ref,
        doclingKind: item._kind,
        doclingLabel: item.label
      }
    }

    // Image
    if (item._kind === 'pictures' || item.label === 'picture') {
      const uri: string | undefined =
        (item as unknown as { image?: { uri?: string } }).image?.uri ??
        (item as unknown as { uri?: string }).uri
      blocks.push({
        ...base,
        type: 'image',
        caption: null,
        alt: text || null,
        assetId: uri ? `img-${base.id}` : null,
        assetUrl: uri ?? null,
        width: null,
        height: null
      })
      continue
    }

    // Table
    if (item._kind === 'tables' || item.label === 'table') {
      const rows = extractTableRows(item)
      blocks.push({
        ...base,
        type: 'table',
        caption: null,
        rows,
        html: null,
        assetId: null
      })
      continue
    }

    // Text-like
    const mapped = labelToBlockType(item.label, text)
    if (mapped.type === 'heading') {
      const level = item.level ?? mapped.level ?? 1
      blocks.push({ ...base, type: 'heading', level, text })
    } else if (mapped.type === 'list_item') {
      blocks.push({
        ...base,
        type: 'list_item',
        text,
        ordered: /^\s*\d+\s+[.)]/.test(text),
        index: 0
      })
    } else if (mapped.type === 'caption') {
      blocks.push({ ...base, type: 'caption', text, forBlockId: null })
    } else if (mapped.type === 'code') {
      blocks.push({ ...base, type: 'code', text, language: null })
    } else if (mapped.type === 'formula') {
      blocks.push({ ...base, type: 'formula', text, latex: text })
    } else if (mapped.type === 'unknown') {
      blocks.push({ ...base, type: 'unknown', rawText: text })
    } else {
      blocks.push({ ...base, type: 'paragraph', text })
    }
  }

  // Pages
  const pages: QuizLabPage[] = (raw.pages ?? []).map((p) => ({
    pageNumber: p.page_no,
    width: p.size?.width ?? 0,
    height: p.size?.height ?? 0,
    dpi: p.dpi ?? null
  }))

  // Deduce pageCount
  const pageCount =
    pages.length > 0
      ? Math.max(...pages.map((p) => p.pageNumber))
      : Math.max(1, ...blocks.map((b) => b.pageNumber), 1)

  // If pages missing, synthesize from blocks
  const finalPages =
    pages.length > 0
      ? pages
      : Array.from({ length: pageCount }, (_, i) => ({
          pageNumber: i + 1,
          width: 0,
          height: 0,
          dpi: null
        }))

  const title = raw.name ?? options.pdfName?.replace(/\.pdf$/i, '') ?? null

  return {
    id: docId,
    title,
    source: {
      pdfPath: options.pdfPath,
      pdfName: options.pdfName ?? raw.name ?? 'document.pdf',
      fileSize: options.fileSize ?? null,
      fileHash: options.fileHash ?? null
    },
    pageCount,
    pages: finalPages,
    blocks,
    metadata: {
      converter: { name: 'docling', version: DOCLING_VERSION },
      createdAt: now,
      conversionTimeMs: options.conversionTimeMs ?? null,
      readingOrderSource: orderRefs.length > 0 ? 'docling_body' : 'page_order'
    }
  }
}

function extractTableRows(
  item: DoclingTextItem
): { text: string; rowSpan?: number; colSpan?: number; isHeader?: boolean }[][] {
  const data = (
    item as unknown as {
      data?: {
        table_cells?: Array<{
          text: string
          row_span?: number
          col_span?: number
          column_header?: boolean
        }> & { grid?: unknown }
      }
    }
  ).data
  if (data?.table_cells && Array.isArray(data.table_cells)) {
    // Very simplified: group by row. Docling cells have row/col indices in some versions.
    // Fallback: single row with all cells
    const cells = data.table_cells as unknown as Array<{
      text: string
      row_span?: number
      col_span?: number
      column_header?: boolean
      row_header?: boolean
    }>
    // Try to reconstruct rows if cells have start_row_offset
    const withPos = cells as unknown as Array<{
      text: string
      start_row_offset_idx?: number
      start_col_offset_idx?: number
    }>
    const hasPos = withPos.some((c) => typeof c.start_row_offset_idx === 'number')
    if (hasPos) {
      const rowMap = new Map<number, typeof cells>()
      for (const cell of cells) {
        const r = (cell as unknown as { start_row_offset_idx?: number }).start_row_offset_idx ?? 0
        if (!rowMap.has(r)) rowMap.set(r, [])
        rowMap.get(r)!.push(cell)
      }
      return [...rowMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, rowCells]) =>
          rowCells.map((c) => ({
            text: c.text ?? '',
            rowSpan: c.row_span,
            colSpan: c.col_span,
            isHeader: !!(c.column_header || c.row_header)
          }))
        )
    }
    return [
      cells.map((c) => ({
        text: c.text ?? '',
        rowSpan: c.row_span,
        colSpan: c.col_span,
        isHeader: !!c.column_header
      }))
    ]
  }
  // Fallback: try to parse text as markdown table
  const text = item.text ?? ''
  if (text.includes('|')) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.includes('|'))
    if (lines.length > 0) {
      return lines.map((line) =>
        line
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((cell) => ({ text: cell }))
      )
    }
  }
  return text ? [[{ text }]] : []
}

// Factory for future MinerU adapter
export interface DocumentAdapter {
  name: string
  adapt(raw: unknown, options: AdaptOptions): QuizLabDocument
}
export const doclingAdapter: DocumentAdapter = {
  name: 'docling',
  adapt: adaptDoclingToQuizLabDocument
}
