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

/**
 * PDF metin seçiminin ekran konumu.
 *
 * Katmanlar arası bir sözleşme: PDF özelliği üretir (DOM Range ölçümü), uygulama
 * sağlayıcısı taslak öğesinde saklar, AI gönderim akışı okur. Bu yüzden tek
 * kaynak buradadır — iki ayrı yapısal kopya bir alan eklendiğinde sessizce
 * ıraklar (ve `endRect` gibi bir alan bir tarafta kaybolur).
 */
export interface SelectionPosition {
  /** Eski hızlı "pill" konumu (seçim noktasının altı/üstü). */
  top: number
  left: number
  width?: number
  height?: number
  /**
   * Seçimin son satırının gerçek DOM rect'i (viewport/client koordinatlarında).
   *
   * İkili eylem menüsünün konumlandırması bu gerçek geometriyi kullanır; menü
   * ölçüsüyle ve panel/viewport sınırlarıyla birlikte TEK konumlandırma kararı
   * verir.
   */
  endRect?: { top: number; bottom: number; left: number; right: number }
}
