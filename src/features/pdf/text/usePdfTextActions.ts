import { useEffect, useCallback, useRef, type RefObject } from 'react'
import { extractSelectedText } from '../text/extractSelectedText'
import { extractPageTextFromDom, invalidatePageCache } from '../text/extractPageTextFromDom'
import type { SelectionPosition } from '../text/types'

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

  onTextSelectionRef.current = onTextSelection
  onTextExtractedRef.current = onTextExtracted
  onNoTextFoundRef.current = onNoTextFound

  const extractCurrentPageText = useCallback(() => {
    const extract = () => {
      const text = extractPageTextFromDom(currentPage)

      if (!text) {
        onNoTextFoundRef.current?.()
        return null
      }

      onTextExtractedRef.current?.(text)
      return text
    }

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(extract, { timeout: 100 })
      return null
    }

    setTimeout(extract, 0)
    return null
  }, [currentPage])

  useEffect(() => {
    if (!textSelectionEnabled || !onTextSelectionRef.current) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let frameId: number | null = null
    let pointerStartedInsideContainer = false

    const clearSelectionState = () => {
      const container = containerRef.current
      container?.classList.remove('pdf-selection-active')
      onTextSelectionRef.current?.('', null)
    }

    const scheduleSelectionUpdate = () => {
      if (frameId) cancelAnimationFrame(frameId)

      frameId = requestAnimationFrame(() => {
        frameId = null

        const selection = window.getSelection()
        const container = containerRef.current
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
      const container = containerRef.current
      pointerStartedInsideContainer =
        !!container && event.target instanceof Node && container.contains(event.target)
    }

    const handlePointerUp = () => {
      const shouldCheckSelection = pointerStartedInsideContainer
      pointerStartedInsideContainer = false
      if (shouldCheckSelection) {
        scheduleSelectionUpdate()
        return
      }

      const selection = window.getSelection()
      const container = containerRef.current
      if (!selection || !container) return

      const result = extractSelectedText(selection, container)
      if (result?.text) {
        scheduleSelectionUpdate()
      }
    }

    const handleSelectionChange = () => {
      if (pointerStartedInsideContainer) return

      if (timeoutId) clearTimeout(timeoutId)

      timeoutId = setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim()

        if (!text || text.length === 0) {
          clearSelectionState()
        }
      }, 50)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('keyup', scheduleSelectionUpdate)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('keyup', scheduleSelectionUpdate)
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (timeoutId) clearTimeout(timeoutId)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [containerRef, textSelectionEnabled])

  useEffect(() => {
    invalidatePageCache(currentPage)
  }, [currentPage])

  return { extractCurrentPageText }
}
