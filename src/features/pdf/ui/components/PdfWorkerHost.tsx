import { Worker } from '@react-pdf-viewer/core'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import { memo, type ReactNode, useEffect } from 'react'

import { installPdfRenderErrorGuard } from '../../errors/pdfRenderErrors'

/**
 * Owns the pdfjs worker for the whole renderer.
 *
 * Mounted at a stable point in the tree (LeftPanel) so the worker outlives
 * individual PDF open/close cycles and tab switches instead of being torn down
 * and rebuilt with each document.
 *
 * The worker URL comes from the npm `pdfjs-dist` package, which is the same
 * package `@react-pdf-viewer/core` peer-depends on — see the note in
 * `features/pdf/index.ts`.
 */
function PdfWorkerHost({ children }: { children: ReactNode }) {
  useEffect(() => installPdfRenderErrorGuard(), [])
  return <Worker workerUrl={pdfjsWorkerUrl}>{children}</Worker>
}

export default memo(PdfWorkerHost)
