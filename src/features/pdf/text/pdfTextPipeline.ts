/**
 * The single entry point both PDF text extractors use.
 *
 * Whole-page extraction and selection extraction differ only in whether heading
 * markers are inferred. Tables, columns, reading order, paragraph continuation
 * and spacing are shared, so the two paths cannot drift into producing different
 * text for the same geometry.
 */
import { buildPdfFlow } from './pdfTextLayout'
import { serializePdfFlow } from './pdfTextSerialization'
import type { PdfTextItem } from './types'

type PdfTextExtractionMode = 'page' | 'selection'

interface ExtractStructuredPdfTextOptions {
  /**
   * `page` may promote measurably larger lines to Markdown headings. `selection`
   * never does: the user selected that text, not a document position, and a
   * partial selection of a heading should not gain `##` it did not contain.
   */
  mode?: PdfTextExtractionMode
}

/**
 * Converts measured PDF runs into structured text.
 *
 * Returns an empty string when nothing measurable was supplied. Callers decide
 * whether that is "no text on the page" or a fallback to the browser's own
 * selection string.
 */
export function extractStructuredPdfText(
  items: PdfTextItem[],
  options: ExtractStructuredPdfTextOptions = {}
): string {
  const blocks = buildPdfFlow(items, {
    detectTables: true,
    mode: options.mode === 'selection' ? 'selection' : 'page'
  })
  return serializePdfFlow(blocks, { inferHeadings: options.mode !== 'selection' })
}
