/**
 * 📐 PDF Viewer — Heavy entry point (lazy-loadable)
 *
 * This barrel contains the heavy PDF viewer components that pull in
 * @react-pdf-viewer/*, pdfjs-dist, and all viewer-related hooks.
 * Consumers should lazy-load this module to keep it out of the main chunk.
 */
export { default as PdfTabStrip } from './ui/components/PdfTabStrip'
export { default as PdfViewer } from './ui/components/PdfViewer'
export { default as PdfWorkerHost } from './ui/components/PdfWorkerHost'
