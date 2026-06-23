import { useAppearance } from '@app/providers'

import { IconDotsVertical } from '@tabler/icons-react'
import {
  lazy,
  memo,
  type MouseEvent as ReactMouseEvent,
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

/**
 * Hoisted JSX for the resize handlebar visual cue (vertical line + grab dots).
 * Defined outside the component so both resizer-drag-area instances share
 * the same element reference — avoids re-creating DOM on every render.
 */
const handlebarNode = (
  <>
    <div className="pointer-events-none absolute inset-y-[15%] left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
    <div className="pointer-events-none absolute top-1/2 left-1/2 flex h-9 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/5 bg-gradient-to-b from-white/[0.03] to-white/[0.06]">
      <IconDotsVertical className="h-3 w-3 text-white/40" />
    </div>
  </>
)

/** Memoized sparkles particles node — only created once instead of every
 *  render. Uses CSS opacity to hide during resize instead of conditional
 *  rendering, which would unmount/remount the expensive canvas on every
 *  resize start/stop.
 *  `prefersReducedMotion` is static (changes only via media query listener)
 *  so it's safe as a dep — if the user changes preference mid-session the
 *  component toggles correctly, but the common case (resize toggle) avoids
 *  the unmount cycle entirely. */
const SparklesNode = memo(function SparklesNode({ hidden }: { hidden: boolean }) {
  return (
    <Suspense fallback={null}>
      <SparklesCore
        background="transparent"
        minSize={0.4}
        maxSize={1}
        particleDensity={12}
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-150 ${hidden ? 'opacity-0' : 'opacity-100'}`}
        particleColor="#FFFFFF"
      />
    </Suspense>
  )
})

function BottomBar({
  onHoverChange,
  onMouseDown,
  onDoubleClick,
  isResizing = false
}: BottomBarProps) {
  const { bottomBarOpacity, bottomBarScale } = useAppearance(
    useShallow((s) => ({
      bottomBarOpacity: s.bottomBarOpacity,
      bottomBarScale: s.bottomBarScale
    }))
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState('prompts')
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

  const handleResizerDoubleClick = useCallback(() => {
    onDoubleClick?.()
  }, [onDoubleClick])

  const handleMouseEnter = useCallback(() => onHoverChange?.(true), [onHoverChange])
  const handleMouseLeave = useCallback(() => onHoverChange?.(false), [onHoverChange])

  const openSettings = useCallback((tab: string) => {
    setSettingsInitialTab(tab)
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  return (
    <>
      <div
        role="presentation"
        className="resizer-hub-container"
        style={shellStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          role="presentation"
          className="resizer-drag-area"
          onMouseDown={handleResizerMouseDown}
          onDoubleClick={handleResizerDoubleClick}
        >
          {handlebarNode}
          {!prefersReducedMotion && <SparklesNode hidden={isResizing} />}
        </div>

        <div
          className="bottom-bar-stack relative flex w-full flex-col items-center"
          style={stackStyle}
        >
          <FloatingDockInner onOpenSettings={openSettings} />
        </div>

        <div
          role="presentation"
          className="resizer-drag-area"
          onMouseDown={handleResizerMouseDown}
          onDoubleClick={handleResizerDoubleClick}
        >
          {handlebarNode}
          {!prefersReducedMotion && <SparklesNode hidden={isResizing} />}
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
