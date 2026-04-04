import { useEffect, useRef, useState, type RefObject } from 'react'

interface AiHomeLayoutState {
  width: number
  isCompact: boolean
  isNarrow: boolean
  isUltraNarrow: boolean
  cardColumns: string
}

const DEFAULT_LAYOUT: AiHomeLayoutState = {
  width: 0,
  isCompact: false,
  isNarrow: false,
  isUltraNarrow: false,
  cardColumns: 'minmax(0, 1fr)'
}

const getLayoutState = (width: number): AiHomeLayoutState => {
  const isCompact = width > 0 && width < 960
  const isNarrow = width > 0 && width < 760
  const isUltraNarrow = width > 0 && width < 620

  return {
    width,
    isCompact,
    isNarrow,
    isUltraNarrow,
    cardColumns:
      width >= 1180
        ? 'repeat(3, minmax(0, 1fr))'
        : width >= 760
          ? 'repeat(2, minmax(0, 1fr))'
          : 'minmax(0, 1fr)'
  }
}

const didLayoutChange = (previous: AiHomeLayoutState, next: AiHomeLayoutState) =>
  previous.isCompact !== next.isCompact ||
  previous.isNarrow !== next.isNarrow ||
  previous.isUltraNarrow !== next.isUltraNarrow ||
  previous.cardColumns !== next.cardColumns

export function useAiHomeLayout(pageRef: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<AiHomeLayoutState>(DEFAULT_LAYOUT)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const node = pageRef.current
    if (!node) {
      return
    }

    const measure = () => {
      const width = Math.round(node.getBoundingClientRect().width)
      const nextLayout = getLayoutState(width)

      setLayout((previous) => (didLayoutChange(previous, nextLayout) ? nextLayout : previous))
    }

    const scheduleMeasure = () => {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        measure()
        return
      }

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        measure()
      })
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', scheduleMeasure)
      return () => {
        window.removeEventListener('resize', scheduleMeasure)
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current)
        }
      }
    }

    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(node)

    return () => {
      observer.disconnect()
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [pageRef])

  return layout
}
