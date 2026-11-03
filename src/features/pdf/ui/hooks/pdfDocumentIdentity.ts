import type { PdfFile } from '@shared-core/types'

/**
 * Stable identity of the open PDF document.
 *
 * The same path can be re-opened with different contents (a regenerated file,
 * a new stream URL), so the path alone is not enough: page edits and the search
 * query must reset when any of these change.
 */
export function pdfDocumentId(pdfFile: PdfFile | null): string | null {
  if (!pdfFile) return null
  return `${pdfFile.path ?? ''}::${pdfFile.streamUrl ?? ''}::${pdfFile.name ?? ''}::${pdfFile.size ?? ''}`
}
