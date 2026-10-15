import { useAppearance } from '@app/providers'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

import { motion, useMotionValue } from 'motion/react'
import { memo, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { type DockTooltipAlign, DockTooltipAlignProvider } from './DockTooltipPlacement'
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

  const {
    visibleTools: rawVisibleTools,
    visibleModels: rawVisibleModels,
    isLayoutSwapped
  } = useAppearance(
    useShallow((s) => ({
      visibleTools: s.visibleTools,
      visibleModels: s.visibleModels,
      isLayoutSwapped: s.isLayoutSwapped
    }))
  )
  const visibleTools = useMemo(() => rawVisibleTools ?? {}, [rawVisibleTools])
  const visibleModels = useMemo(() => rawVisibleModels ?? {}, [rawVisibleModels])

  // The AI panel always sits on the dock's trailing side (a swapped layout is a
  // `row-reverse`, which puts it back on the leading one), and it is a native
  // view that paints over the DOM. Tooltips spill the opposite way so their
  // overflowing half lands on the PDF panel, where it is actually visible.
  const tooltipAlign: DockTooltipAlign = isLayoutSwapped ? 'start' : 'end'

  const handleMouseMove = useCallback((e: React.MouseEvent) => mouseY.set(e.clientY), [mouseY])
  const handleMouseLeaveReset = useCallback(() => mouseY.set(Infinity), [mouseY])

  return (
    <DockTooltipAlignProvider value={tooltipAlign}>
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeaveReset}
        className="border-border/60 bg-card/30 flex w-full flex-col items-center gap-1.5 rounded-2xl border p-1.5 py-2"
      >
        <div className="flex w-full flex-col items-center gap-1">
          {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_SETTINGS] !== false && (
            <SettingsToolButton onOpenSettings={onOpenSettings} />
          )}

          {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_SWAP] !== false && <SwapToolButton />}

          {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_PDF_FOCUS] !== false && (
            <PdfFocusToolButton />
          )}

          {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_AI_FOCUS] !== false && (
            <AiFocusToolButton />
          )}

          {visibleTools[APP_CONSTANTS.TOUR_TARGETS.TOOL_PICKER] !== false && <PickerToolButton />}

          <GeminiToolButton onOpenSettings={onOpenSettings} />
        </div>

        <div
          className="bg-border/70 my-[calc(0.25rem*var(--bar-scale-factor,1))] h-px w-5"
          role="separator"
        />

        <ModelIconsList visibleModels={visibleModels} />
      </motion.div>
    </DockTooltipAlignProvider>
  )
})

/* ── Sub-components extracted to FloatingDockToolButtons.tsx ── */

export default FloatingDockInner
