import type { Placement } from '../model/types'

interface TooltipSize {
  readonly width: number
  readonly height: number
}

interface Position {
  readonly top: number
  readonly left: number
}

const DEFAULT_VIEWPORT_PADDING = 16
const DEFAULT_TOOLTIP_SIZE: TooltipSize = { width: 440, height: 200 }

function clampToViewport(pos: Position, tooltipSize: TooltipSize, padding: number): Position {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const left = Math.max(padding, Math.min(pos.left, vw - tooltipSize.width - padding))
  const top = Math.max(padding, Math.min(pos.top, vh - tooltipSize.height - padding))

  return { top, left }
}

function calculateAutoPlacement(
  targetRect: DOMRect,
  tooltipSize: TooltipSize,
  padding: number
): Position {
  const spaceAbove = targetRect.top
  const spaceBelow = window.innerHeight - targetRect.bottom
  const spaceLeft = targetRect.left
  const spaceRight = window.innerWidth - targetRect.right

  const targetCenterX = targetRect.left + targetRect.width / 2
  const targetCenterY = targetRect.top + targetRect.height / 2

  if (spaceAbove >= tooltipSize.height + padding) {
    return clampToViewport(
      {
        top: targetRect.top - tooltipSize.height - padding,
        left: targetCenterX - tooltipSize.width / 2
      },
      tooltipSize,
      padding
    )
  }

  if (spaceBelow >= tooltipSize.height + padding) {
    return clampToViewport(
      {
        top: targetRect.bottom + padding,
        left: targetCenterX - tooltipSize.width / 2
      },
      tooltipSize,
      padding
    )
  }

  if (spaceRight >= tooltipSize.width + padding) {
    return clampToViewport(
      {
        top: targetCenterY - tooltipSize.height / 2,
        left: targetRect.right + padding
      },
      tooltipSize,
      padding
    )
  }

  if (spaceLeft >= tooltipSize.width + padding) {
    return clampToViewport(
      {
        top: targetCenterY - tooltipSize.height / 2,
        left: targetRect.left - tooltipSize.width - padding
      },
      tooltipSize,
      padding
    )
  }

  return clampToViewport(
    {
      top: targetCenterY - tooltipSize.height / 2,
      left: targetCenterX - tooltipSize.width / 2
    },
    tooltipSize,
    padding
  )
}

export function calculatePlacement(
  targetRect: DOMRect | null,
  placement: Placement,
  tooltipSize: TooltipSize = DEFAULT_TOOLTIP_SIZE,
  viewportPadding: number = DEFAULT_VIEWPORT_PADDING
): Position {
  if (!targetRect || placement === 'center') {
    return {
      top: (window.innerHeight - tooltipSize.height) / 2,
      left: (window.innerWidth - tooltipSize.width) / 2
    }
  }

  const targetCenterX = targetRect.left + targetRect.width / 2
  const targetCenterY = targetRect.top + targetRect.height / 2

  switch (placement) {
    case 'top':
      return clampToViewport(
        {
          top: targetRect.top - tooltipSize.height - viewportPadding,
          left: targetCenterX - tooltipSize.width / 2
        },
        tooltipSize,
        viewportPadding
      )

    case 'bottom':
      return clampToViewport(
        {
          top: targetRect.bottom + viewportPadding,
          left: targetCenterX - tooltipSize.width / 2
        },
        tooltipSize,
        viewportPadding
      )

    case 'left':
      return clampToViewport(
        {
          top: targetCenterY - tooltipSize.height / 2,
          left: targetRect.left - tooltipSize.width - viewportPadding
        },
        tooltipSize,
        viewportPadding
      )

    case 'right':
      return clampToViewport(
        {
          top: targetCenterY - tooltipSize.height / 2,
          left: targetRect.right + viewportPadding
        },
        tooltipSize,
        viewportPadding
      )

    case 'auto':
      return calculateAutoPlacement(targetRect, tooltipSize, viewportPadding)

    default:
      return clampToViewport(
        {
          top: targetRect.top - tooltipSize.height - viewportPadding,
          left: targetCenterX - tooltipSize.width / 2
        },
        tooltipSize,
        viewportPadding
      )
  }
}
