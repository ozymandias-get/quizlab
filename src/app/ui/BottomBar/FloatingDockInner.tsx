import { Dock } from '@app/components/ui/dock'
import { useAppearance } from '@app/providers'
import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { TooltipProvider } from '@shared/ui/components/primitives'

import { memo, useMemo } from 'react'
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

  return (
    <TooltipProvider delayDuration={0}>
      <DockTooltipAlignProvider value={tooltipAlign}>
        <Dock
          orientation="vertical"
          iconSize={32}
          iconMagnification={34}
          iconDistance={90}
          className="dock-surface mt-0 h-auto max-h-[calc(100dvh-4rem)] w-full flex-col gap-0.5 overflow-hidden rounded-2xl border border-white/12 bg-zinc-950/95 p-1.5 py-3 backdrop-blur-xl"
        >
          <div className="flex w-full flex-col items-center gap-0.5">
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

            {visibleTools['tool-gemini-web'] !== false && (
              <GeminiToolButton onOpenSettings={onOpenSettings} />
            )}
          </div>

          <div className="my-1 h-px w-5 bg-white/[0.07]" role="separator" />

          <ModelIconsList visibleModels={visibleModels} />
        </Dock>
      </DockTooltipAlignProvider>
    </TooltipProvider>
  )
})

/* ── Sub-components extracted to FloatingDockToolButtons.tsx ── */

export default FloatingDockInner
