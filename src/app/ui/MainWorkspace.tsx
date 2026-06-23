import { AuroraBackground } from '@app/components/ui/aurora-background'
import AestheticLoader from '@ui/components/AestheticLoader'
import BottomBar from '@ui/layout/BottomBar'
import LeftPanel from '@ui/layout/LeftPanel'

import { motion, type Variants } from 'motion/react'
import {
  type ComponentProps,
  type CSSProperties,
  lazy,
  memo,
  type MouseEventHandler,
  type RefObject,
  Suspense
} from 'react'

const AiWebview = lazy(() => import('@features/ai/webview').then((m) => ({ default: m.AiWebview })))

interface MainWorkspaceProps {
  isLayoutSwapped: boolean
  leftPanelWidth: number
  leftPanelRef: RefObject<HTMLDivElement>
  resizerRef: RefObject<HTMLDivElement>
  containerVariants: Variants
  leftPanelVariants: Variants
  rightPanelVariants: Variants
  resizerVariants: Variants
  gpuAcceleratedStyle: CSSProperties
  handleMouseDown: MouseEventHandler<Element>
  handleResizerDoubleClick?: () => void
  isWebviewMounted: boolean
  isResizing: boolean
  isBarHovered: boolean
  onBarHoverChange: (isHovered: boolean) => void
  leftPanelProps: ComponentProps<typeof LeftPanel>
  bgMode: 'ambient' | 'solid'
}

function MainWorkspace({
  isLayoutSwapped,
  leftPanelWidth,
  leftPanelRef,
  resizerRef,
  containerVariants,
  leftPanelVariants,
  rightPanelVariants,
  resizerVariants,
  gpuAcceleratedStyle,
  handleMouseDown,
  handleResizerDoubleClick,
  isWebviewMounted,
  isResizing,
  isBarHovered,
  onBarHoverChange,
  leftPanelProps,
  bgMode
}: MainWorkspaceProps) {
  return (
    <motion.main
      key="main-panels"
      initial={false}
      animate="visible"
      exit="hidden"
      variants={containerVariants}
      className={`relative flex h-screen w-screen px-2 py-2 sm:px-3 sm:py-3 md:px-4 md:py-4 lg:px-5 lg:py-5 ${isLayoutSwapped ? 'flex-row-reverse' : 'flex-row'}`}
      style={gpuAcceleratedStyle}
    >
      {bgMode === 'ambient' && <AuroraBackground className="rounded-[var(--radius-2xl)]" />}

      <motion.div
        ref={leftPanelRef}
        variants={leftPanelVariants}
        className="h-full"
        data-tour-id="tour-target-left-panel"
        style={{
          ...gpuAcceleratedStyle,
          width: `${leftPanelWidth}%`,
          flexShrink: 0
        }}
      >
        <LeftPanel {...leftPanelProps} />
      </motion.div>

      <motion.div
        ref={resizerRef}
        variants={resizerVariants}
        className="relative z-30 h-full shrink-0"
        style={gpuAcceleratedStyle}
      >
        <BottomBar
          onHoverChange={onBarHoverChange}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleResizerDoubleClick}
          isResizing={isResizing}
        />
      </motion.div>

      <motion.div
        variants={rightPanelVariants}
        className="relative flex min-w-[280px] flex-1 flex-col sm:min-w-[320px] lg:min-w-[350px]"
        data-tour-id="tour-target-right-panel"
        style={gpuAcceleratedStyle}
      >
        <Suspense fallback={<AestheticLoader />}>
          {isWebviewMounted ? (
            <AiWebview isResizing={isResizing} isBarHovered={isBarHovered} />
          ) : (
            <AestheticLoader />
          )}
        </Suspense>
      </motion.div>
    </motion.main>
  )
}

export default memo(MainWorkspace)
