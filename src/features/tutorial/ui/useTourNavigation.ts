import { useCallback, useEffect, useState } from 'react'

interface Rect {
  top: number
  left: number
  width: number
  height: number
  id?: string
  targetId?: string
  index?: number
}

interface StepConfig {
  targetId?: string
  targetIds?: string[]
  titleKey: string
  textKey: string
}

function areRectsSame(r1: Rect[], r2: Rect[]) {
  if (r1.length !== r2.length) return false
  return r1.every((rect, i) => {
    const other = r2[i]
    return (
      rect.targetId === other.targetId &&
      Math.abs(rect.top - other.top) < 1 &&
      Math.abs(rect.left - other.left) < 1 &&
      Math.abs(rect.width - other.width) < 1 &&
      Math.abs(rect.height - other.height) < 1
    )
  })
}

function collectRects(config: StepConfig): Rect[] {
  const newRects: Rect[] = []

  if (config.targetId) {
    const el = document.getElementById(config.targetId)
    if (el) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        newRects.push({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          id: config.targetId,
          targetId: config.targetId
        })
      }
    }
  }

  if (config.targetIds) {
    config.targetIds.forEach((id, index) => {
      const el = document.getElementById(id)
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          newRects.push({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            id,
            index,
            targetId: id
          })
        }
      }
    })
  }

  return newRects
}

interface UseTargetRectsOptions {
  isActive: boolean
  stepConfig: StepConfig | undefined
}

export function useTargetRects({ isActive, stepConfig }: UseTargetRectsOptions): Rect[] {
  const [rects, setRects] = useState<Rect[]>([])

  const updateRects = useCallback(() => {
    if (!isActive || !stepConfig) return

    const newRects = collectRects(stepConfig)
    setRects((prev) => {
      if (areRectsSame(prev, newRects)) return prev
      return newRects
    })
  }, [isActive, stepConfig])

  useEffect(() => {
    if (!isActive) {
      setRects([])
      return
    }

    updateRects()

    window.addEventListener('resize', updateRects)
    window.addEventListener('scroll', updateRects, true)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateRects()
      })
      const targets: Element[] = []
      if (stepConfig?.targetId) {
        const el = document.getElementById(stepConfig.targetId)
        if (el) targets.push(el)
      }
      if (stepConfig?.targetIds) {
        stepConfig.targetIds.forEach((id) => {
          const el = document.getElementById(id)
          if (el) targets.push(el)
        })
      }
      targets.forEach((el) => resizeObserver!.observe(el))
    }

    return () => {
      window.removeEventListener('resize', updateRects)
      window.removeEventListener('scroll', updateRects, true)
      resizeObserver?.disconnect()
    }
  }, [isActive, stepConfig, updateRects])

  return rects
}

interface UseTourNavigationOptions {
  totalSteps: number
  onClose: () => void
}

export function useTourNavigation({ totalSteps, onClose }: UseTourNavigationOptions) {
  const [step, setStep] = useState(0)

  const handleNext = useCallback(() => {
    let shouldClose = false
    setStep((s) => {
      if (s < totalSteps - 1) return s + 1
      shouldClose = true
      return s
    })
    if (shouldClose) onClose()
  }, [totalSteps, onClose])

  const handleSkip = useCallback(() => {
    onClose()
  }, [onClose])

  const resetStep = useCallback(() => {
    setStep(0)
  }, [])

  return { step, handleNext, handleSkip, resetStep }
}
