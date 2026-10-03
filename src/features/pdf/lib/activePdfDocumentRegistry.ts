/**
 * Active PDFDocumentProxy registry — avoids reloading the PDF for each
 * high-DPI page render (screenshot capture).
 *
 * Viewer sets the active document on load; render paths reuse it when the
 * fingerprint matches. Previously lived under the OCR feature; moved here
 * because the PDF viewer and screenshot capture rely on it independently.
 */

export interface ActivePdfDocument {
  fingerprint: string
  /** pdf.js marks a proxy unusable once its loading task is destroyed. */
  destroyed?: boolean
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

/**
 * Returns the registered document when it belongs to `pdfUrl` AND is still
 * alive, so render paths can reuse it instead of reloading large PDFs. Returns
 * `null` when no document is registered, the URL differs, or the proxy has been
 * destroyed (caller must load + destroy its own).
 *
 * The liveness check matters because a viewer Reload bumps only
 * `viewerReloadKey`, which remounts <Viewer> and makes pdf.js destroy the old
 * loading task while the owning component stays mounted. A URL-only match
 * handed the dead proxy to capture, whose getPage() then rejected and silently
 * degraded the capture to a screen-resolution canvas clone.
 */
export function getActivePdfDocument(pdfUrl: string): ActivePdfDocument | null {
  if (!activePdfDocument || activePdfUrl !== pdfUrl) return null

  if (activePdfDocument.destroyed === true) {
    clearActivePdfDocument()
    return null
  }

  return activePdfDocument
}
