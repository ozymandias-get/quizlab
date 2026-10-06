import { findNativePageCanvas } from '@features/pdf/native/nativePdfDom'

import { pageLayerSelectors } from '../lib/pdfViewerDom'

/**
 * Owner of "which on-screen canvas belongs to page N".
 *
 * Both capture paths depend on it — the direct canvas clone in
 * `lib/renderPageToImage.ts` and the screenshot pipeline — so they share one
 * cache. The exact-page constraint is deliberate: never fall back to an arbitrary
 * canvas, that would capture the wrong page.
 *
 * ## Two renderers, one question
 *
 * Two viewer implementations are installed at once during the migration, so this
 * resolves whichever one is on screen:
 *
 *  - **native** — `[data-native-pdf-page="N"] canvas[data-native-pdf-canvas]`,
 *    resolved by `nativePdfDom.findNativePageCanvas`. The native viewer keeps a
 *    single canvas, so the page attribute on the page box is the *only* thing that
 *    can confirm the pixels belong to the page being asked for; a page that is not
 *    mounted answers `null` instead of quietly returning the current page.
 *  - **legacy** — the `@react-pdf-viewer` page layer, resolved through
 *    `lib/pdfViewerDom`. Unchanged, including the two-selector fallback.
 *
 * Two DOM vocabularies, two owners: this file knows *that* both exist and in which
 * order to try them, and never a selector of its own. `lib/pdfViewerDom.ts` still
 * knows nothing native, and `nativePdfDom.ts` still knows nothing `rpv-*`.
 *
 * Which renderer answers is not a choice this function makes: the build-time
 * `VITE_NATIVE_PDF_VIEWER` flag decides which markup exists at all, so on any
 * given build only one branch can ever match, and the native branch running on a
 * legacy build costs a single `querySelector` that finds nothing.
 *
 * Cache ownership: the cached canvas is dropped as soon as it leaves the DOM, so
 * a re-rasterized page is re-discovered rather than served stale. Identity is
 * therefore enough to tell the two renderers apart too — a native canvas is never
 * a legacy page layer's canvas.
 */
interface CachedCanvas {
  page: number
  canvas: HTMLCanvasElement
}

let canvasCache: CachedCanvas | null = null

function findLegacyLayerForPage(pageNumber: number): Element | null {
  for (const selector of pageLayerSelectors(pageNumber)) {
    const element = document.querySelector(selector)
    if (element) return element
  }
  return null
}

function findLegacyCanvasForPage(pageNumber: number): HTMLCanvasElement | null {
  const layer = findLegacyLayerForPage(pageNumber)
  if (!layer) return null
  const canvas = layer.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null
  return canvas
}

export function findPageCanvas(currentPage: number): HTMLCanvasElement | null {
  if (canvasCache && !canvasCache.canvas.isConnected) {
    canvasCache = null
  }

  if (canvasCache && canvasCache.page === currentPage && canvasCache.canvas.isConnected) {
    return canvasCache.canvas
  }

  const canvas = findNativePageCanvas(document, currentPage) ?? findLegacyCanvasForPage(currentPage)
  if (!canvas) return null

  canvasCache = { page: currentPage, canvas }
  return canvas
}
