import { useAppearance } from '@app/providers'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

import { motion, useMotionValue } from 'motion/react'
import { memo, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  AiFocusToolButton,
  GeminiToolButton,
  ModelIconsList,
  PdfFocusToolButton,
  PickerToolButton,
  SettingsToolButton,
  SwapToolButton
} from './FloatingDockToolButtons'

interface FloatingDockInnerProps {
  onOpenSettings: (tab?: string) => void
}

const FloatingDockInner = memo(function FloatingDockInner({
  onOpenSettings
}: FloatingDockInnerProps) {
  const mouseY = useMotionValue(Infinity)

  const { visibleTools: rawVisibleTools, visibleModels: rawVisibleModels } = useAppearance(
    useShallow((s) => ({
      visibleTools: s.visibleTools,
      visibleModels: s.visibleModels
    }))
  )
  const visibleTools = useMemo(() => rawVisibleTools ?? {}, [rawVisibleTools])
  const visibleModels = useMemo(() => rawVisibleModels ?? {}, [rawVisibleModels])

  const handleMouseMove = useCallback((e: React.MouseEvent) => mouseY.set(e.clientY), [mouseY])
  const handleMouseLeaveReset = useCallback(() => mouseY.set(Infinity), [mouseY])

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeaveReset}
      className="flex w-full flex-col items-center gap-1.5 py-2"
    >
      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_SETTINGS] !== false && (
        <SettingsToolButton onOpenSettings={onOpenSettings} />
      )}

      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_SWAP] !== false && <SwapToolButton />}

      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_PDF_FOCUS] !== false && <PdfFocusToolButton />}

      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_AI_FOCUS] !== false && <AiFocusToolButton />}

      {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_PICKER] !== false && <PickerToolButton />}

      <GeminiToolButton onOpenSettings={onOpenSettings} />

      <div
        className="my-[calc(0.25rem*var(--bar-scale-factor,1))] h-px w-4 bg-white/10"
        role="separator"
      />

      <ModelIconsList visibleModels={visibleModels} />
    </motion.div>
  )
})

/* ── Sub-components extracted to FloatingDockToolButtons.tsx ── */

export default FloatingDockInner
