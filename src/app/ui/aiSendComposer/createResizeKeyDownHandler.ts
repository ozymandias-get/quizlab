import {
  clamp,
  clampLayout,
  MAX_HEIGHT,
  MAX_WIDTH,
  MIN_HEIGHT,
  MIN_WIDTH,
  saveLayoutToStorage
} from './layoutUtils'
import type { DockLayout, ResizeDirection } from './types'

const RESIZE_KEY_STEP_PX = 16
const RESIZE_KEY_SHIFT_MULTIPLIER = 4

interface CreateResizeKeyDownHandlerOptions {
  getLayout: () => DockLayout
  setLayout: (layout: DockLayout) => void
}

/**
 * Keyboard alternative to pointer-drag resizing: the resize edges are
 * focusable, so arrow keys must actually resize instead of being dead tab
 * stops. Shift multiplies the step for coarser adjustments.
 */
export function createResizeKeyDownHandler({
  getLayout,
  setLayout
}: CreateResizeKeyDownHandlerOptions) {
  return (dir: ResizeDirection) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    let deltaX = 0
    let deltaY = 0
    switch (event.key) {
      case 'ArrowLeft':
        deltaX = -RESIZE_KEY_STEP_PX
        break
      case 'ArrowRight':
        deltaX = RESIZE_KEY_STEP_PX
        break
      case 'ArrowUp':
        deltaY = -RESIZE_KEY_STEP_PX
        break
      case 'ArrowDown':
        deltaY = RESIZE_KEY_STEP_PX
        break
      default:
        return
    }
    if (event.shiftKey) {
      deltaX *= RESIZE_KEY_SHIFT_MULTIPLIER
      deltaY *= RESIZE_KEY_SHIFT_MULTIPLIER
    }
    event.preventDefault()
    event.stopPropagation()

    const s = getLayout()
    let newX = s.x,
      newY = s.y,
      newW = s.width,
      newH = s.height

    if (dir.includes('e')) newW = clamp(s.width + deltaX, MIN_WIDTH, MAX_WIDTH)
    if (dir.includes('w')) {
      newW = clamp(s.width - deltaX, MIN_WIDTH, MAX_WIDTH)
      newX = s.x + (s.width - newW)
    }
    if (dir.includes('s')) newH = clamp(s.height + deltaY, MIN_HEIGHT, MAX_HEIGHT)
    if (dir.includes('n')) {
      newH = clamp(s.height - deltaY, MIN_HEIGHT, MAX_HEIGHT)
      newY = s.y + (s.height - newH)
    }

    if (newX === s.x && newY === s.y && newW === s.width && newH === s.height) return

    const finalLayout = clampLayout({ x: newX, y: newY, width: newW, height: newH })
    setLayout(finalLayout)
    saveLayoutToStorage(finalLayout)
  }
}
