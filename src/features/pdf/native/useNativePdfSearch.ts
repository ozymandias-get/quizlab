/**
 * The native search lifecycle: a keyword in, highlight rectangles out.
 *
 * ## The contract it satisfies
 *
 * The toolbar calls exactly two functions:
 *
 * ```
 * highlight(keyword)   → highlight every match on the rendered page
 * clearHighlights()    → drop the query and empty the overlay
 * ```
 *
 * Nothing else exists. There is no match count, no next/previous match, no
 * current-match marker and no auto page jump — those are not part of the product,
 * and `PdfSearchBar` does not render them. This hook implements exactly that
 * surface, so the search bar itself, `usePdfSearchStore`, `Ctrl+F` and `Escape`
 * need no renderer branch.
 *
 * ## Scope: the rendered page
 *
 * One page at a time — `ViewMode.SinglePage` parity with what the viewer did —
 * and the keyword is kept, so the next page's text layer is highlighted as soon as
 * it renders. There is deliberately no whole-document index: it would need every
 * page's text extracted in the background to
 * produce nothing the single-page viewer can show.
 *
 * ## Synchronous, and that is the point
 *
 * Matching and measuring both read the DOM that is already there, in one pass — exactly
 * as the plugin's own `highlightAll` does inside a render effect. So there is no
 * in-flight request to cancel and no generation counter: the effect's dependency list
 * *is* the invalidation, and it lists everything that can make a previous rectangle
 * wrong.
 *
 * | dependency        | what it invalidates                                                       |
 * | ----------------- | ------------------------------------------------------------------------- |
 * | `documentKey`     | a reload or a different file: different text, same page number            |
 * | `currentPage`     | a different page's runs                                                    |
 * | `scale`           | every run is rebuilt at the new scale, so every rectangle is stale          |
 * | `textLayerReady`  | a new generation of runs exists (page change, zoom, reload, first render)   |
 * | `keyword`         | a new query                                                               |
 * | `enabled`         | the flag was switched off                                                  |
 *
 * The zoom case deserves the detail, because it is the one that could have been wrong:
 * the text-layer effect is declared *before* this one in the controller, so on a scale
 * change React runs its cleanup first, and that cleanup empties the text-layer container
 * synchronously. By the time this effect runs there are therefore no runs to match, the
 * overlay is emptied, and the rectangles are re-measured when `textLayerReady` flips back
 * to true against the new scale. Stale geometry is removed before the new one exists,
 * never after — the same ordering `useNativePdfRender` and `useNativePdfTextLayer`
 * already rely on.
 *
 * ## A failed search is not a failed page
 *
 * `searchError` exists for the same reason `textLayerError` does and is deliberately not
 * rendered as an error shell: the canvas is painted and the text layer is mounted, so a
 * search that cannot measure leaves a readable page with no results. The error is
 * observable, and the overlay is emptied rather than left showing rectangles from a
 * query that has since failed.
 *
 * ## Reduced motion
 *
 * `window.matchMedia('(prefers-reduced-motion: reduce)')` is read once per search run
 * rather than cached in a module-level variable. A search run measures it a handful
 * of times per query, so a module-level cache would buy nothing and would be a
 * stale-read hazard: the user can change the setting between two queries, and a
 * cached answer would silently keep the old one. The reader itself now lives in
 * `nativePdfReducedMotion.ts`, shared with the page transition rather than copied.
 */
import { type RefObject, useCallback, useEffect, useState } from 'react'

import { prefersReducedMotion } from './nativePdfReducedMotion'
import {
  findNativePdfSearchHighlights,
  findNativeSearchPageBox,
  findNativeSearchTextLayer,
  renderNativePdfSearchHighlights
} from './nativePdfSearch'

/** The whole search surface, and the whole of it the legacy plugin exposes too. */
export interface NativePdfSearchHandle {
  /** Highlight every match of `keyword` on the rendered page. */
  highlight: (keyword: string) => void
  /** Drop the query and empty the overlay. */
  clearHighlights: () => void
  /**
   * Message for a genuine search failure. `null` while searching and on teardown.
   *
   * Not rendered, on purpose — see the module note. A failed search is a degraded page,
   * not a broken one.
   */
  searchError: string | null
}

/** Keep a search failure to one safe line, as the other two layers do. */
function toSearchErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.length > 200 ? message.slice(0, 200) : message
}

/**
 * Where the motion preference is read from.
 *
 * `prefersReducedMotion` is shared with the page transition — see
 * `nativePdfReducedMotion.ts`, which also explains why it is read fresh every time
 * instead of being cached at module scope.
 */
interface UseNativePdfSearchOptions {
  /** The feature flag. `false` keeps the overlay empty and the keyword unmeasured. */
  enabled: boolean
  /** The page's search-highlight layer; it exists only while the native viewer renders. */
  searchLayerRef: RefObject<HTMLElement | null>
  /**
   * Document identity — `(pdfUrl, reloadKey)`. A reload supersedes every rectangle even
   * though the page number is unchanged.
   */
  documentKey: string
  /** 1-based. */
  currentPage: number
  /** The viewport scale the runs were rendered at. */
  scale: number
  /**
   * True once the current page's text layer has finished rendering.
   *
   * This is the search's trigger, and it is what makes a recompute mean something: the
   * runs it matches are the runs on screen right now.
   */
  textLayerReady: boolean
}

export function useNativePdfSearch({
  enabled,
  searchLayerRef,
  documentKey,
  currentPage,
  scale,
  textLayerReady
}: UseNativePdfSearchOptions): NativePdfSearchHandle {
  const [keyword, setKeyword] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)

  // Identity-only setters, so the toolbar's `useCallback`s over them stay stable and
  // `PdfToolbar` does not re-render on every zoom frame.
  const highlight = useCallback((nextKeyword: string) => setKeyword(nextKeyword), [])
  const clearHighlights = useCallback(() => setKeyword(''), [])

  useEffect(() => {
    const layer = searchLayerRef.current
    if (!layer) return

    // No query, no page, no runs, or the flag is off: nothing is drawn and nothing is
    // left over. This is also the path every geometry invalidation takes.
    if (!enabled || !textLayerReady || !keyword.trim()) {
      layer.replaceChildren()
      setSearchError(null)
      return
    }

    const pageBox = findNativeSearchPageBox(layer)
    const textLayer = findNativeSearchTextLayer(layer)
    if (!pageBox || !textLayer) {
      layer.replaceChildren()
      return
    }

    try {
      const { highlights } = findNativePdfSearchHighlights({
        keyword,
        pageNumber: currentPage,
        pageBox,
        textLayer
      })
      renderNativePdfSearchHighlights(layer, highlights, {
        keyword,
        reducedMotion: prefersReducedMotion()
      })
      setSearchError(null)
    } catch (error) {
      // Measured against a DOM that is being rebuilt, or a Range the host cannot create.
      // The page stays readable; the search goes quiet rather than showing rectangles
      // from a query that no longer resolved.
      layer.replaceChildren()
      setSearchError(toSearchErrorMessage(error))
    }
    // `documentKey` and `scale` are not read here on purpose: they are the two inputs
    // that invalidate geometry without changing the layer's DOM identity, and a zoom has
    // to empty the overlay immediately rather than wait for the next keyword.
  }, [enabled, searchLayerRef, documentKey, currentPage, scale, textLayerReady, keyword])

  return { highlight, clearHighlights, searchError }
}
