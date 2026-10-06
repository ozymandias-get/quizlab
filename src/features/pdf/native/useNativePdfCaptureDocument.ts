/**
 * Publishing the mounted native document to the capture pipeline.
 *
 * ## Why capture needs a door into the viewer
 *
 * A high-DPI capture wants the already-decoded document: re-fetching and
 * re-decoding a 400-page textbook for one screenshot is the difference between
 * instant and unusable. `@react-pdf-viewer` made that reachable by handing its
 * `PDFDocumentProxy` to `activePdfDocumentRegistry` on document load. The native
 * viewer renders exactly one page onto one canvas and holds its document inside
 * `PdfDocumentManager`, so nothing about it is reachable from a context-menu
 * handler or a toolbar click — hence this hook, which is the native equivalent of
 * that one `onDocumentLoad` call.
 *
 * ## What it publishes
 *
 * A capture handle over the manager's *current* document — not a copy of it, and
 * not ownership of it. The handle answers `isAlive()` by asking the manager
 * whether it still holds that document, so the registry never has to know about
 * PDF.js 6 and never has to trust a version-specific flag.
 *
 * ## When it publishes, and when it withdraws
 *
 * Registration is tied to **document identity and readiness**, not to mount:
 *
 *  - `(enabled, pdfUrl, reloadKey, status)` — `status === 'ready'` is the only
 *    state in which the manager is known to hold the document for `pdfUrl`
 *  - a reload changes `reloadKey`, so the old entry is withdrawn before the new
 *    document exists; even if it were not withdrawn, the old handle's `isAlive()`
 *    is already `false`, because `load()` disposes the previous task before
 *    starting the next one
 *  - unmount (or the flag flipping off) withdraws it
 *
 * Withdrawal is token-scoped: `clearActivePdfDocument(token)` only empties the
 * slot when the entry is still *this* viewer's. With `LeftPanel` and the
 * `FocusOverlay` both mounted on the same file, a viewer unmounting cannot evict
 * its live sibling's document.
 *
 * ## Inert while the flag is off
 *
 * Every early return happens **before** any withdrawal. The legacy viewer
 * registers its own proxy through the frozen `PdfViewerElement`, and an inert
 * native hook that cleared the slot on mount would erase it.
 */
import {
  type ActivePdfDocumentToken,
  clearActivePdfDocument,
  setActivePdfDocument
} from '@features/pdf/lib/activePdfDocumentRegistry'
import type { NativePdfDocumentStatus } from '@features/pdf/native/useNativePdfDocument'
import type { NativePdfEngineHandle } from '@features/pdf/native/useNativePdfEngine'

import { useEffect, useRef } from 'react'

import { createNativeCaptureHandle } from './nativePdfCaptureDocument'

interface UseNativePdfCaptureDocumentOptions {
  enabled: boolean
  engine: NativePdfEngineHandle
  status: NativePdfDocumentStatus
  pdfUrl: string
  /** Bumped by Reload; same URL, new document generation. */
  reloadKey: number
}

export function useNativePdfCaptureDocument({
  enabled,
  engine,
  status,
  pdfUrl,
  reloadKey
}: UseNativePdfCaptureDocumentOptions): void {
  const tokenRef = useRef<ActivePdfDocumentToken | null>(null)

  useEffect(() => {
    if (!enabled || status !== 'ready' || !pdfUrl) return

    const engineInstance = engine()
    if (!engineInstance) return

    const document = engineInstance.manager.getDocument()
    // `status === 'ready'` is set from the resolved document, so the manager
    // holding it is an invariant of the hook rather than a coincidence — checked
    // anyway because publishing a handle over nothing would make every capture
    // miss and silently temp-load instead.
    if (!document) return

    tokenRef.current = setActivePdfDocument(
      createNativeCaptureHandle(engineInstance.manager, document),
      pdfUrl,
      // The document generation. Recorded rather than compared: liveness is the
      // decision, and the manager — not the registry — is what knows whether a
      // generation is still current.
      `${pdfUrl}::${reloadKey}`
    )

    return () => {
      const token = tokenRef.current
      tokenRef.current = null
      clearActivePdfDocument(token)
    }
  }, [enabled, engine, status, pdfUrl, reloadKey])
}
