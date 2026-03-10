/**
 * PDF Types
 */

export type PdfSelectOptions = { filterName?: string }
export type PdfSelection = { path: string; name: string; size: number; streamUrl: string }
export type PdfStreamResult = { streamUrl: string }

export type PdfFile = {
  path?: string | null
  name?: string
  streamUrl?: string | null
  size?: number | null
}
