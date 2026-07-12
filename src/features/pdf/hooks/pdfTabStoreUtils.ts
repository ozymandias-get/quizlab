import type { PdfFile } from '@shared-core/types'

import type { PdfTab } from './types'

export const createViewerSessionKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `vs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

export const normalizeTitle = (title?: string): string | undefined => {
  const normalized = title?.trim()
  return normalized || undefined
}

export const toPdfFile = (file: PdfFile): PdfFile => ({
  name: file.name,
  path: file.path,
  streamUrl: file.streamUrl,
  size: file.size
})

export const isSamePdfStream = (prev: PdfFile | null | undefined, next: PdfFile): boolean => {
  if (!prev) return false
  return (
    (prev.path ?? '') === (next.path ?? '') && (prev.streamUrl ?? '') === (next.streamUrl ?? '')
  )
}

export const isSamePdfFull = (a: PdfFile | null | undefined, b: PdfFile): boolean => {
  if (!a) return false
  return (
    (a.path ?? '') === (b.path ?? '') &&
    (a.streamUrl ?? '') === (b.streamUrl ?? '') &&
    (a.name ?? '') === (b.name ?? '') &&
    (a.size ?? null) === (b.size ?? null)
  )
}

export interface PdfTabState {
  pdfTabs: PdfTab[]
  activePdfTabId: string
}

export interface PdfTabActions {
  openPdfInTab: (file: PdfFile) => PdfTab
  setActivePdfTab: (tabId: string) => void
  closePdfTab: (tabId: string) => void
  addEmptyPdfTab: () => void
  goToPdfHome: () => void
  openGoogleDriveTab: () => void
  renamePdfTab: (tabId: string, title?: string) => void
}

export type PdfTabStore = PdfTabState & PdfTabActions
