import { useLayoutEffect, useState, useRef, useCallback, type RefObject } from 'react'

const MEASURE_THROTTLE_MS = 32

export function useBottomBarPanelHeight(
  barRef: RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  bottomBarScale: number
) {
  const [panelHeight, setPanelHeight] = useState(0)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  const lastMeasureRef = useRef(0)
  const pendingFrameRef = useRef<number | null>(null)

  const measure = useCallback(() => {
    const shell = barRef.current
    if (!shell) return

    const hub = shell.querySelector<HTMLButtonElement>('.hub-center-btn')
    if (!hub) return

    const toolsScrollArea = shell.querySelector<HTMLElement>(
      '[data-testid="tools-panel-scroll-area"]'
    )
    const modelsScrollArea = shell.querySelector<HTMLElement>(
      '[data-testid="models-panel-scroll-area"]'
    )
    const shellRect = shell.getBoundingClientRect()
    const hubRect = hub.getBoundingClientRect()
    const edgePadding = 12
    const panelGap = 10
    const availableTopHeight = Math.max(0, hubRect.top - shellRect.top - edgePadding - panelGap)
    const availableBottomHeight = Math.max(
      0,
      shellRect.bottom - hubRect.bottom - edgePadding - panelGap
    )

    const minContentHeight = Math.min(
      toolsScrollArea?.scrollHeight ?? 0,
      modelsScrollArea?.scrollHeight ?? 0
    )

    const sharedHeight = Math.max(
      0,
      Math.floor(
        Math.min(availableTopHeight, availableBottomHeight, Math.max(minContentHeight, 48))
      )
    )

    setPanelHeight((prev) => (prev === sharedHeight ? prev : sharedHeight))
  }, [barRef])

  const scheduleMeasure = useCallback(() => {
    const now = performance.now()
    if (now - lastMeasureRef.current < MEASURE_THROTTLE_MS) return

    lastMeasureRef.current = now

    if (pendingFrameRef.current !== null) {
      cancelAnimationFrame(pendingFrameRef.current)
    }

    pendingFrameRef.current = requestAnimationFrame(() => {
      pendingFrameRef.current = null
      measure()
    })
  }, [measure])

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      lastMeasureRef.current = performance.now()
      measure()
    })
    return () => cancelAnimationFrame(id)
  }, [measure])

  useLayoutEffect(() => {
    const shell = barRef.current
    if (!shell) return

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleMeasure) : null

    const observedElements = [
      shell,
      shell.querySelector('.hub-center-btn'),
      shell.querySelector('[data-testid="tools-panel-scroll-area"]')?.firstElementChild,
      shell.querySelector('[data-testid="models-panel-scroll-area"]')?.firstElementChild
    ].filter((element): element is Element => element instanceof Element)

    observedElements.forEach((element) => resizeObserver?.observe(element))

    const handleResize = scheduleMeasure
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current)
        pendingFrameRef.current = null
      }
      resizeObserver?.disconnect()
    }
  }, [barRef, bottomBarScale, scheduleMeasure])

  return panelHeight
}
