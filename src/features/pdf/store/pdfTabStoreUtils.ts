import type { PdfFile } from '@shared-core/types'

import { moveItemWithinList } from '@shared/lib/reorderList'

import type { PdfTab } from '../hooks/types'
import { isSamePdfPath } from '../lib/pdfPathIdentity'

export const createViewerSessionKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `vs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

/**
 * Moves a PDF tab next to another one; the shared helper keeps drag order in
 * the tab strip and in the AI tab strip on the same rule.
 */
export function moveTabWithinList<T extends { id: string }>(
  tabs: T[],
  tabId: string,
  targetId: string,
  placeAfter: boolean
): T[] {
  return moveItemWithinList(tabs, tabId, targetId, placeAfter)
}

export const toPdfFile = (file: PdfFile): PdfFile => ({
  name: file.name,
  path: file.path,
  streamUrl: file.streamUrl,
  size: file.size
})

/**
 * Whether two registrations describe the same document.
 *
 * A re-registration of the same file gets a new stream URL; that is not a new
 * document and must not reset its viewer session (page, scroll, search).
 */
export const isSamePdfDocument = (prev: PdfFile | null | undefined, next: PdfFile): boolean => {
  if (!prev) return false
  return isSamePdfPath(prev.path, next.path) && (prev.size ?? null) === (next.size ?? null)
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

interface PdfTabState {
  pdfTabs: PdfTab[]
  activePdfTabId: string
}

interface PdfTabActions {
  openPdfInTab: (file: PdfFile) => PdfTab
  setActivePdfTab: (tabId: string) => void
  closePdfTab: (tabId: string) => void
  addEmptyPdfTab: () => void
  goToPdfHome: () => void
  openGoogleDriveTab: () => void
  movePdfTab: (tabId: string, targetId: string, placeAfter: boolean) => void
}

export type PdfTabStore = PdfTabState & PdfTabActions
