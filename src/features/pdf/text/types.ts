import type { SelectionPosition } from '@shared-core/types'

// PDF özelliği tarafından üretilip app katmanında saklanan ortak sözleşme;
// tanımı @shared-core/types'te yaşar (bkz. shared/types/pdf.ts).
export type { SelectionPosition }

/**
 * One positioned run of PDF text, measured from the DOM.
 *
 * Shared by the two extractors in this folder. `extractPageTextFromDom`
 * measures a whole text layer and `extractSelectedText` measures only the runs
 * a selection covers, and both hand their boxes to the exported
 * `orderTextItems` — which is why the shape has exactly one declaration rather
 * than one per file. Two structurally identical local interfaces let the
 * shared signature silently accept the other module's shape, and then diverge
 * the first time one of them gains a field.
 */
export interface PdfTextItem {
  text: string
  left: number
  top: number
  width: number
  height: number
}
