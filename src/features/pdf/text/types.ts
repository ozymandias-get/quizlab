export interface TextExtractionResult {
  text: string
  source: 'selection' | 'page' | 'document'
  pageNumber?: number
}

export interface SelectionPosition {
  top: number
  left: number
}
