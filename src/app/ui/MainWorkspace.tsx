import React, { memo, type CSSProperties, type MouseEventHandler, type RefObject } from 'react'
import { motion, type Variants } from 'framer-motion'
import { AiWebview } from '@features/ai'
import BottomBar from '@ui/layout/BottomBar'
import AestheticLoader from '@ui/components/AestheticLoader'
import LeftPanel from '@ui/layout/LeftPanel'

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
  isWebviewMounted: boolean
  isResizing: boolean
  isBarHovered: boolean
  onBarHoverChange: (isHovered: boolean) => void
  leftPanelProps: React.ComponentProps<typeof LeftPanel>
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
  isWebviewMounted,
  isResizing,
  isBarHovered,
  onBarHoverChange,
  leftPanelProps
}: MainWorkspaceProps) {
  return (
    <motion.main
      key="main-panels"
      initial={false}
      animate="visible"
      exit="hidden"
      variants={containerVariants}
      className={`flex h-screen w-screen p-5 ${isLayoutSwapped ? 'flex-row-reverse' : 'flex-row'}`}
      style={gpuAcceleratedStyle}
    >
      <motion.div
        ref={leftPanelRef}
        variants={leftPanelVariants}
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
        className="h-full flex-shrink-0 relative z-30"
        style={gpuAcceleratedStyle}
      >
        <BottomBar onHoverChange={onBarHoverChange} onMouseDown={handleMouseDown} />
      </motion.div>

      <motion.div
        variants={rightPanelVariants}
        className="glass-panel flex-1 min-w-[350px] flex flex-col overflow-hidden relative"
        style={gpuAcceleratedStyle}
      >
        {isWebviewMounted ? (
          <AiWebview isResizing={isResizing} isBarHovered={isBarHovered} />
        ) : (
          <AestheticLoader />
        )}
      </motion.div>
    </motion.main>
  )
}

export default memo(MainWorkspace)
