import { Logger } from '@shared/lib/logger'

interface ResolvedTarget {
  readonly rect: DOMRect | null
  readonly element: Element | null
  readonly found: boolean
}

function resolveTarget(targetId: string | undefined): ResolvedTarget {
  if (!targetId) {
    return { rect: null, element: null, found: false }
  }

  const element =
    document.querySelector(`[data-tour-id="${targetId}"]`) ?? document.getElementById(targetId)

  if (!element) {
    Logger.warn(`[Tutorial] Target not found: ${targetId}`)
    return { rect: null, element: null, found: false }
  }

  const rect = element.getBoundingClientRect()
  return { rect, element, found: true }
}

export function resolveTargetRects(targetIds: readonly string[]): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>()

  for (const targetId of targetIds) {
    const { rect, found } = resolveTarget(targetId)
    if (found && rect) {
      rects.set(targetId, rect)
    }
  }

  return rects
}
