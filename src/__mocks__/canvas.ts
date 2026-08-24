// Vite / Vitest için `canvas` native modül stub'ı.
// pdfjs-dist/legacy/build/pdf.js Node'da `require('canvas')` ile DOMMatrix/Path2D
// polyfill dener; `canvas` kurulu değilse her seferinde warning basar.
// Bu stub `require('canvas')` çağrısını boş bir modüle yönlendirerek uyarıyı susturur.
// Gerçek render Chromium'da native DOMMatrix/Path2D kullandığı için stub'ın içeriği önemli değil.
export const DOMMatrix = (globalThis as unknown as { DOMMatrix?: unknown }).DOMMatrix ?? class {}
export const Path2D = (globalThis as unknown as { Path2D?: unknown }).Path2D ?? class {}
export default {}
