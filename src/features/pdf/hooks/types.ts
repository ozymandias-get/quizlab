import type { PdfFile } from '@shared-core/types'

export type LastReadingInfo = {
  name: string
  page: number
  totalPages: number
  path: string
  lastOpenedAt?: number
}

export type ResumePdfResult = 'success' | 'not_found' | 'missing' | 'error'

export interface ReadingProgressUpdate {
  path: string
  page?: number
  totalPages?: number
  lastOpenedAt?: number
}

export interface PdfTab {
  id: string
  file: PdfFile | null
  title?: string
  kind?: 'pdf' | 'drive'
  webviewUrl?: string
  viewerSessionKey?: string
}
