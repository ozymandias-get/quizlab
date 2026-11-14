import type { SelectionPosition } from '@shared-core/types'

// PDF özelliği tarafından üretilip app katmanında saklanan ortak sözleşme;
// tanımı @shared-core/types'te yaşar (bkz. shared/types/pdf.ts).
export type { SelectionPosition }

/**
 * One positioned run of PDF text, measured from the DOM.
 *
 * Shared by the two extractors in this folder. `extractPageTextFromDom`
 * measures a whole text layer and `extractSelectedText` measures only the runs
 * a selection covers, and both hand their boxes to the layout pipeline in
 * `./pdfTextLayout` — which is why the shape has exactly one declaration rather
 * than one per file. Two structurally identical local interfaces let the
 * shared signature silently accept the other module's shape, and then diverge
 * the first time one of them gains a field.
 *
 * `fontSize` is optional on purpose. The native text layer carries PDF.js's
 * `--font-height` on every run, so the current viewer can supply it; the
 * fallback paths and the older fixtures cannot. Every consumer must treat a
 * missing value as "unknown", never as a default size, because a fabricated
 * size would turn an ordinary line into a heading.
 */
export interface PdfTextItem {
  text: string
  left: number
  top: number
  width: number
  height: number
  /** PDF.js `--font-height` for this run, in CSS pixels. */
  fontSize?: number
  /**
   * 1-based source page. Selection can span pages (and a future scroll viewer
   * can mount more than one), so the layout pipeline groups by this before it
   * measures rows: two pages can legitimately have a line at the same `top`,
   * and merging them would move text across a page boundary.
   */
  page?: number
}

/**
 * A horizontal slice of one visual row: the runs between two large gaps.
 *
 * Two columns on the same baseline are two fragments of one row, while a
 * normal line is one fragment. Splitting here — before column clustering —
 * is what keeps a two-column row from being treated as a single wide line.
 */
export interface PdfTextFragment {
  text: string
  left: number
  right: number
  top: number
  bottom: number
  fontSize: number
  /** Index of the visual row this fragment belongs to (top to bottom). */
  row: number
}

/** One reconstructed visual line inside a column (or a single-column page). */
export interface PdfTextLine {
  text: string
  left: number
  right: number
  top: number
  bottom: number
  fontSize: number
  row: number
}

/** A table whose cell relationships were reliable enough to reconstruct. */
export interface PdfTableBlock {
  kind: 'table'
  header: string[]
  rows: string[][]
  /**
   * True when the first row is usable as a header and every data row maps to
   * the same columns. False means Markdown would invent a header, so the
   * serializer preserves the rows as labelled/tabular plain text instead.
   */
  confident: boolean
  /**
   * True when the first row is the table's real header rather than merely its
   * first data row. A partial selection cannot prove the header was included,
   * so this stays false there and the serializer keeps every source row.
   */
  headerTrusted: boolean
  /** Median font size of the table's cells, used for the page's body baseline. */
  fontSize: number
}

/** A group of lines that belong to the same reading block (one column). */
interface PdfLinesBlock {
  kind: 'lines'
  lines: PdfTextLine[]
}

/** A line that spans the column layout (heading, caption, divider). */
interface PdfSpannerBlock {
  kind: 'spanner'
  line: PdfTextLine
}

export type PdfFlowBlock = PdfLinesBlock | PdfSpannerBlock | PdfTableBlock
