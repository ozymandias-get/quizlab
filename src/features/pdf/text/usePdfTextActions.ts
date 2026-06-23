import { type RefObject, useCallback, useEffect, useRef } from 'react'

import { extractPageTextFromDom, invalidatePageCache } from './extractPageTextFromDom'
import { extractSelectedText } from './extractSelectedText'
import type { SelectionPosition } from './types'

interface UsePdfTextActionsOptions {
  containerRef: RefObject<HTMLElement | null>
  currentPage: number
  onTextSelection?: (text: string, position: SelectionPosition | null) => void
  onTextExtracted?: (text: string) => void
  onNoTextFound?: () => void
  textSelectionEnabled?: boolean
}

export function usePdfTextActions({
  containerRef,
  currentPage,
  onTextSelection,
  onTextExtracted,
  onNoTextFound,
  textSelectionEnabled = true
}: UsePdfTextActionsOptions) {
  const onTextSelectionRef = useRef(onTextSelection)
  const onTextExtractedRef = useRef(onTextExtracted)
  const onNoTextFoundRef = useRef(onNoTextFound)
  const currentPageRef = useRef(currentPage)

  onTextSelectionRef.current = onTextSelection
  onTextExtractedRef.current = onTextExtracted
  onNoTextFoundRef.current = onNoTextFound
  currentPageRef.current = currentPage

  /**
   * Reads currentPage from a ref instead of depending on the state value so
   * the callback identity is stable across page changes.  This prevents
   * handleAddCurrentPageTextToAi (and any useMemo/useCallback that wraps it)
   * from being recreated on every page transition.
   *
   * The ref is updated during render (line above) so by the time the user
   * triggers this callback (click / menu), currentPageRef.current always
   * holds the latest value.
   */
  const extractCurrentPageText = useCallback(() => {
    const page = currentPageRef.current
    const extract = () => {
      const text = extractPageTextFromDom(page)

      if (!text) {
        onNoTextFoundRef.current?.()
        return null
      }

      onTextExtractedRef.current?.(text)
      return text
    }

    // Defer extraction past the page transition settle period.
    // Using requestIdleCallback (without a forced timeout) lets the browser
    // schedule the work when the main thread is idle.  The setTimeout
    // fallback waits 500ms to avoid competing with the page render.
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(extract)
      return null
    }

    setTimeout(extract, 500)
    return null
  }, [])

  useEffect(() => {
    if (!textSelectionEnabled || !onTextSelectionRef.current) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let frameId: number | null = null
    let pointerStartedInsideContainer = false
    let scrollFreezeTimer: ReturnType<typeof setTimeout> | null = null
    let isScrolling = false

    const container = containerRef.current
    if (!container) return

    const clearSelectionState = () => {
      container.classList.remove('pdf-selection-active')
      onTextSelectionRef.current?.('', null)
    }

    const scheduleSelectionUpdate = () => {
      if (frameId) cancelAnimationFrame(frameId)

      frameId = requestAnimationFrame(() => {
        frameId = null

        const selection = window.getSelection()
        const onSelection = onTextSelectionRef.current

        if (!onSelection || !container) {
          clearSelectionState()
          return
        }

        const result = extractSelectedText(selection, container)

        if (result === null) {
          clearSelectionState()
          return
        }

        container.classList.toggle('pdf-selection-active', !!result.text && !!result.position)
        onSelection(result.text, result.position)
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (isScrolling) return
      pointerStartedInsideContainer =
        event.target instanceof Node && container.contains(event.target)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (isScrolling) return

      const shouldCheckSelection = pointerStartedInsideContainer
      pointerStartedInsideContainer = false
      if (shouldCheckSelection) {
        scheduleSelectionUpdate()
        return
      }

      // Fallback: only process if the pointerup target is inside the PDF panel
      const target = event.target
      if (!(target instanceof Node)) return
      if (!container.contains(target)) {
        const panel = container.parentElement
        if (!panel || !panel.contains(target)) return
      }

      const selection = window.getSelection()
      if (!selection) return
      const result = extractSelectedText(selection, container)
      if (result?.text) {
        scheduleSelectionUpdate()
      }
    }

    const handleSelectionChange = () => {
      if (isScrolling) return
      if (pointerStartedInsideContainer) return

      const selection = window.getSelection()

      // Quick bail-out: ignore selection changes outside the PDF container.
      // This avoids queuing RAF/timeout work when the user selects text in
      // the AI panel, search bar, or any other part of the app.
      if (
        !selection ||
        selection.isCollapsed ||
        !selection.anchorNode ||
        !container.contains(selection.anchorNode)
      ) {
        clearSelectionState()
        return
      }

      // Detached anchor node (page transition) — skip processing.
      if (!selection.anchorNode.isConnected) {
        return
      }

      if (timeoutId) clearTimeout(timeoutId)

      timeoutId = setTimeout(() => {
        const text = selection.toString().trim()
        if (!text) {
          clearSelectionState()
        }
      }, 50)
    }

    // Scroll freeze within the PDF container only. During scroll, pages
    // move under the cursor and the browser may fire spurious pointer
    // and selection events. The lock releases 150ms after scrolling stops.
    const handleScroll = (event: Event) => {
      // Only freeze for scrolls inside the PDF container
      if (!container.contains(event.target as Node)) return
      isScrolling = true
      if (scrollFreezeTimer) clearTimeout(scrollFreezeTimer)
      scrollFreezeTimer = setTimeout(() => {
        scrollFreezeTimer = null
        isScrolling = false
      }, 150)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('selectionchange', handleSelectionChange)
    // Capture scroll only inside the PDF container
    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('selectionchange', handleSelectionChange)
      container.removeEventListener('scroll', handleScroll)
      if (timeoutId) clearTimeout(timeoutId)
      if (frameId) cancelAnimationFrame(frameId)
      if (scrollFreezeTimer) clearTimeout(scrollFreezeTimer)
    }
  }, [containerRef, textSelectionEnabled])

  useEffect(() => {
    if (currentPage > 0) {
      invalidatePageCache(currentPage)
    }
  }, [currentPage])

  return { extractCurrentPageText }
}
