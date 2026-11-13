import { useAppearance } from '@app/providers'
import { setDockHovered } from '@shared/stores/dockHoverStore'

import { GripVertical } from 'lucide-react'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  lazy,
  memo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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

/**
 * The dock is scaled as a whole, so its visual box grows past the flex slot it
 * occupies. The handles sit in the drag strips around that slot; the scale
 * overflow (computed in BottomBar) moves them out to the real visual edge
 * instead of leaving them underneath the dock surface.
 */
const handlebarAboveDock = (
  <div className={`${HANDLE_CLASS} resizer-handle--above`}>
    <GripVertical className="text-muted-foreground h-3.5 w-3.5" />
  </div>
)

const handlebarBelowDock = (
  <div className={`${HANDLE_CLASS} resizer-handle--below`}>
    <GripVertical className="text-muted-foreground h-3.5 w-3.5" />
  </div>
)

/** Vertical room a handle needs outside the visual dock: 40px pill + 6px gap + padding. */
const DOCK_HANDLE_CLEARANCE = 48

/** Single shared particles node — lightweight micro-canvas.
 *  Stays mounted across a resize and pauses in place,
 *  so the animation loop does not consume CPU cycles during drag.
 *  It is not rendered at all under `prefers-reduced-motion`. */
const SparklesNode = memo(function SparklesNode({ paused = false }: { paused?: boolean }) {
  return (
    <Suspense fallback={null}>
      <SparklesCore
        background="transparent"
        minSize={0.4}
        maxSize={0.9}
        particleDensity={5}
        paused={paused}
        className="motion-normal pointer-events-none absolute inset-0 h-full w-full opacity-20"
        particleColor="#d4d4d8"
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

  const { shellStyle, stackStyle, clampedScale } = useBottomBarStyles(
    bottomBarOpacity,
    bottomBarScale
  )
  const shellRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const [dockMetrics, setDockMetrics] = useState({ maxVisualHeight: 0, overflow: 0 })

  // Measure the actual rail slot instead of assuming a fixed viewport inset.
  // The main workspace padding changes at the md/lg breakpoints, and the dock
  // itself is scaled, so the handles need both the shell height and the
  // transform overflow to stay outside the dock surface.
  useLayoutEffect(() => {
    const shell = shellRef.current
    const stack = stackRef.current
    if (!shell || !stack) return

    const measure = () => {
      const shellHeight = shell.clientHeight
      const layoutHeight = stack.offsetHeight
      const overflow = Math.max(0, (layoutHeight * (clampedScale - 1)) / 2)
      const maxVisualHeight =
        shellHeight > 0 ? Math.max(120, shellHeight - DOCK_HANDLE_CLEARANCE * 2) : 0

      setDockMetrics((previous) =>
        previous.maxVisualHeight === maxVisualHeight && Math.abs(previous.overflow - overflow) < 0.5
          ? previous
          : { maxVisualHeight, overflow }
      )
    }

    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer) {
      observer.observe(shell)
      observer.observe(stack)
    }

    return () => observer?.disconnect()
  }, [clampedScale])

  const shellStyleWithDock = useMemo<CSSProperties>(
    () =>
      ({
        ...shellStyle,
        ...(dockMetrics.maxVisualHeight > 0
          ? { '--dock-max-visual-height': `${dockMetrics.maxVisualHeight}px` }
          : {}),
        '--dock-visual-overflow': `${dockMetrics.overflow}px`
      }) as CSSProperties,
    [dockMetrics, shellStyle]
  )

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

  const handleMouseEnter = useCallback(() => {
    setDockHovered(true)
    onHoverChange?.(true)
  }, [onHoverChange])
  const handleMouseLeave = useCallback(() => {
    setDockHovered(false)
    onHoverChange?.(false)
  }, [onHoverChange])

  const openSettings = useCallback((tab?: string) => {
    setSettingsInitialTab(tab)
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
    setSettingsInitialTab(undefined)
  }, [])

  return (
    <>
      <div
        ref={shellRef}
        role="presentation"
        className="resizer-hub-container relative"
        style={shellStyleWithDock}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {!prefersReducedMotion && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <SparklesNode paused={isResizing} />
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
          ref={stackRef}
          className="bottom-bar-stack relative flex w-full flex-col items-center"
          style={stackStyle}
        >
          <FloatingDockInner onOpenSettings={openSettings} isResizing={isResizing} />
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
