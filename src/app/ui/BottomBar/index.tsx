import { useAppearance } from '@app/providers'

import { GripVertical } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  lazy,
  memo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  Suspense,
  useCallback,
  useEffect,
  useState
} from 'react'
import { useShallow } from 'zustand/react/shallow'

import FloatingDockInner from './FloatingDockInner'
import SettingsModalPortal from './SettingsModalPortal'
import type { BottomBarProps } from './types'
import { useBottomBarStyles } from './useBottomBarStyles'

const SparklesCore = lazy(() => import('@app/components/ui/sparkles'))

/** Fixed pixel step for keyboard-driven resizing (ArrowLeft/ArrowRight). */
const RESIZE_KEY_STEP_PX = 32

/**
 * Hoisted JSX for the resize handlebar pill. Defined outside the component so
 * both resizer-drag-area instances share the same element reference — avoids
 * re-creating DOM on every render.
 *
 * The pill's surface is owned by `.resizer-handle` in `_resizer.css`, which is
 * also what carries its hover/focus states. The vertical track is drawn
 * separately by `.resizer-drag-area::after` — the two never overlap.
 *
 * One pill flanks the top of the dock, one the bottom. Anchoring them to the
 * dock's edges (instead of the middle of each empty rail segment) keeps the
 * pair reading as a single affordance that frames the dock, rather than two
 * lozenges stranded far from the thing they resize.
 */
const HANDLE_CLASS =
  'resizer-handle pointer-events-none absolute left-1/2 flex h-10 w-5 -translate-x-1/2 items-center justify-center'

const handlebarAboveDock = (
  <div className={`${HANDLE_CLASS} bottom-1.5`}>
    <GripVertical className="text-muted-foreground h-3.5 w-3.5" />
  </div>
)

const handlebarBelowDock = (
  <div className={`${HANDLE_CLASS} top-1.5`}>
    <GripVertical className="text-muted-foreground h-3.5 w-3.5" />
  </div>
)

/** Single shared particles node — one canvas instead of two.
 *  Pauses (unmounts) during resize / reduced-motion / hidden tab to stop
 *  the rAF loop and save GPU/battery. `loadSlim` is globally cached so
 *  remount after resize is cheap (no re-download). */
const SparklesNode = memo(function SparklesNode({ hidden }: { hidden: boolean }) {
  if (hidden) return null
  return (
    <Suspense fallback={null}>
      <SparklesCore
        background="transparent"
        minSize={0.4}
        maxSize={1}
        particleDensity={12}
        paused={hidden}
        className="motion-normal pointer-events-none absolute inset-0 h-full w-full opacity-100"
        particleColor="#FFFFFF"
      />
    </Suspense>
  )
})

function BottomBar({
  onHoverChange,
  onMouseDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onLostPointerCapture,
  onDoubleClick,
  onKeyboardResize,
  isResizeReversed = false,
  isResizing = false
}: BottomBarProps) {
  const { bottomBarOpacity, bottomBarScale } = useAppearance(
    useShallow((s) => ({
      bottomBarOpacity: s.bottomBarOpacity,
      bottomBarScale: s.bottomBarScale
    }))
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleMediaQuery = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }
    mediaQuery.addEventListener('change', handleMediaQuery)
    return () => mediaQuery.removeEventListener('change', handleMediaQuery)
  }, [])

  const { shellStyle, stackStyle } = useBottomBarStyles(bottomBarOpacity, bottomBarScale)

  const handleResizerMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      onMouseDown?.(e)
    },
    [onMouseDown]
  )

  const handleResizerPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      onPointerDown?.(e)
    },
    [onPointerDown]
  )

  const handleResizerPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      onPointerMove?.(e)
    },
    [onPointerMove]
  )

  const handleResizerPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      onPointerUp?.(e)
    },
    [onPointerUp]
  )

  const handleResizerLostPointerCapture = useCallback(
    (e: ReactPointerEvent) => {
      onLostPointerCapture?.(e)
    },
    [onLostPointerCapture]
  )

  const handleResizerDoubleClick = useCallback(() => {
    onDoubleClick?.()
  }, [onDoubleClick])

  const handleResizerKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home') return
      e.preventDefault()
      if (e.key === 'Home') {
        onDoubleClick?.()
        return
      }
      const direction = isResizeReversed ? -1 : 1
      onKeyboardResize?.(
        e.key === 'ArrowLeft' ? -RESIZE_KEY_STEP_PX * direction : RESIZE_KEY_STEP_PX * direction
      )
    },
    [onKeyboardResize, onDoubleClick, isResizeReversed]
  )

  const handleMouseEnter = useCallback(() => onHoverChange?.(true), [onHoverChange])
  const handleMouseLeave = useCallback(() => onHoverChange?.(false), [onHoverChange])

  const openSettings = useCallback((tab?: string) => {
    setSettingsInitialTab(tab)
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
    setSettingsInitialTab(undefined)
  }, [])

  const shouldShowSparkles = !prefersReducedMotion && !isResizing

  return (
    <>
      <div
        role="presentation"
        className="resizer-hub-container relative"
        style={shellStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {shouldShowSparkles && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <SparklesNode hidden={false} />
          </div>
        )}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-keyshortcuts="ArrowLeft ArrowRight Home"
          tabIndex={0}
          className="resizer-drag-area"
          onMouseDown={handleResizerMouseDown}
          onPointerDown={handleResizerPointerDown}
          onPointerMove={handleResizerPointerMove}
          onPointerUp={handleResizerPointerUp}
          onLostPointerCapture={handleResizerLostPointerCapture}
          onDoubleClick={handleResizerDoubleClick}
          onKeyDown={handleResizerKeyDown}
        >
          {handlebarAboveDock}
        </div>

        <div
          className="bottom-bar-stack relative flex w-full flex-col items-center"
          style={stackStyle}
        >
          <FloatingDockInner onOpenSettings={openSettings} />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-keyshortcuts="ArrowLeft ArrowRight Home"
          tabIndex={0}
          className="resizer-drag-area"
          onMouseDown={handleResizerMouseDown}
          onPointerDown={handleResizerPointerDown}
          onPointerMove={handleResizerPointerMove}
          onPointerUp={handleResizerPointerUp}
          onLostPointerCapture={handleResizerLostPointerCapture}
          onDoubleClick={handleResizerDoubleClick}
          onKeyDown={handleResizerKeyDown}
        >
          {handlebarBelowDock}
        </div>
      </div>

      <SettingsModalPortal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        initialTab={settingsInitialTab}
      />
    </>
  )
}

export default memo(BottomBar)
