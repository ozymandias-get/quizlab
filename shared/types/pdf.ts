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

/** Electron PDF window context menu (Zoom In / Zoom Out / Reset Zoom) → renderer PDF zoom. */
export type PdfViewerZoomAction = 'in' | 'out' | 'reset'
