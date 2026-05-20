export type PdfAiTextSource = 'selection' | 'current-page' | 'full-document'
export type PdfAiImageSource = 'full-page' | 'selection'

export interface PdfAiTextItemMeta {
  source: 'pdf'
  textSource: PdfAiTextSource
  pageNumber?: number
  fileName?: string
}

export interface PdfAiImageItemMeta {
  source: 'pdf'
  imageSource: PdfAiImageSource
  pageNumber?: number
  fileName?: string
}
