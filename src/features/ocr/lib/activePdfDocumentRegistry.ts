/**
 * Active PDFDocumentProxy registry — avoids reloading the PDF for each OCR job.
 * Viewer sets the active document on load; OCR reuses it if fingerprint matches.
 *
 * Extracted from `renderPageToImage.ts`: document registration changes for
 * viewer-lifecycle reasons, while page rendering changes for quality/perf
 * reasons. `renderPageToImage.ts` re-exports the public functions so existing
 * import paths keep working.
 */

export interface ActivePdfDocument {
  fingerprint: string
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number }
    render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
      promise: Promise<void>
      cancel?: () => void
    }
  }>
  destroy: () => void
}

let activePdfDocument: ActivePdfDocument | null = null
let activePdfUrl: string | null = null

export function setActivePdfDocument(
  doc: ActivePdfDocument | null,
  pdfUrl: string | null,
  fingerprint?: string | null
): void {
  activePdfDocument = doc
  activePdfUrl = pdfUrl ?? null
  // Prefer fingerprint from doc if available
  if (doc && fingerprint) {
    try {
      ;(doc as unknown as Record<string, unknown>).fingerprint = fingerprint
    } catch {}
  }
}

export function clearActivePdfDocument(): void {
  activePdfDocument = null
  activePdfUrl = null
}

export function getActivePdfDocumentFingerprint(): string | null {
  if (!activePdfDocument) return null
  const anyDoc = activePdfDocument as unknown as Record<string, unknown>
  const fp = anyDoc.fingerprint ?? (anyDoc.fingerprints as string[] | undefined)?.[0]
  if (typeof fp === 'string' && fp.length > 0) return fp
  const fingerprints = anyDoc.fingerprints as string[] | undefined
  if (fingerprints && fingerprints[0]) return fingerprints[0]
  return null
}

/**
 * Returns the registered document when it belongs to `pdfUrl`, so render
 * paths can reuse it instead of reloading large PDFs. Returns `null` when no
 * document is registered or the URL differs (caller must load + destroy).
 */
export function getActivePdfDocument(pdfUrl: string): ActivePdfDocument | null {
  if (activePdfDocument && activePdfUrl === pdfUrl) return activePdfDocument
  return null
}
