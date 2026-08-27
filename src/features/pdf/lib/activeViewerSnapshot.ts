import { createDocumentFingerprint } from '@features/ocr/lib/cacheKey'

type PdfFileLite = {
  path?: string | null
  name?: string | null
  size?: number | null
  streamUrl?: string | null
}

let snapshot: {
  pdfFile: PdfFileLite | null
  page: number
  fingerprint: string | null
} = { pdfFile: null, page: 1, fingerprint: null }

export function setActiveViewerSnapshot(pdfFile: PdfFileLite | null, page: number): void {
  if (!pdfFile) {
    snapshot = { pdfFile: null, page, fingerprint: null }
    return
  }
  const fp = createDocumentFingerprint({
    path: pdfFile.path ?? null,
    name: pdfFile.name ?? null,
    size: pdfFile.size ?? null,
    streamUrl: pdfFile.streamUrl ?? null
  })
  snapshot = { pdfFile, page, fingerprint: fp }
}

export function getActiveViewerSnapshot(): {
  pdfFile: PdfFileLite | null
  page: number
  fingerprint: string | null
} {
  return snapshot
}

export function clearActiveViewerSnapshot(): void {
  snapshot = { pdfFile: null, page: 1, fingerprint: null }
}
