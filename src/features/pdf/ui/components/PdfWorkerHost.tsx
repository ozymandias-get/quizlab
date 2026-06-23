import { Worker } from '@react-pdf-viewer/core'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import { memo, type ReactNode } from 'react'

/**
 * Wraps children with the pdfjs `<Worker>` context provider.
 *
 * By mounting this at a stable point in the React tree (e.g. LeftPanel), the
 * pdfjs web worker is created once at app startup and stays alive for the
 * entire session — even when the user closes all PDFs or switches tabs.
 *
 * This eliminates the ~100–300ms Worker creation/destruction overhead on every
 * PDF open/close cycle and on tab switches.
 */
function PdfWorkerHost({ children }: { children: ReactNode }) {
  return <Worker workerUrl={pdfjsWorkerUrl}>{children}</Worker>
}

export default memo(PdfWorkerHost)
