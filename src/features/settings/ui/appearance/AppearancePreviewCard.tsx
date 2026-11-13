import { memo } from 'react'

interface AppearancePreviewCardProps {
  selectionColor: string
  bottomBarOpacity: number
  bottomBarScale: number
  label: string
}

/**
 * Miniature workspace that uses the live appearance values. Theme tokens
 * (background/card/border) update through CSS variables by themselves; the
 * selection colour and dock opacity/scale are applied inline so the card moves
 * with the sliders while the settings modal is still open.
 */
const AppearancePreviewCard = memo(function AppearancePreviewCard({
  selectionColor,
  bottomBarOpacity,
  bottomBarScale,
  label
}: AppearancePreviewCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-950/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-ql-10 text-muted-foreground tracking-ql-label font-semibold uppercase">
          {label}
        </span>
        <span aria-hidden className="bg-border h-px flex-1" />
      </div>

      <div className="flex min-h-[6.5rem] gap-2">
        {/* PDF side */}
        <div
          className="relative flex flex-[3] items-center justify-center overflow-hidden rounded-lg border bg-zinc-900/45"
          style={{
            borderColor: `color-mix(in oklch, ${selectionColor} 35%, transparent)`
          }}
        >
          <div className="shadow-ambient-md h-20 w-14 rounded-sm bg-white" />
          <span
            aria-hidden
            className="absolute top-2 left-2 h-1 w-8 rounded-full"
            style={{ backgroundColor: selectionColor }}
          />
        </div>

        {/* Chat side */}
        <div className="flex flex-[2] flex-col justify-end gap-1.5 rounded-lg border border-white/[0.07] bg-zinc-900/70 p-2">
          <div className="h-2 w-3/4 rounded-full bg-white/10" />
          <div
            className="h-2 w-2/3 self-end rounded-full"
            style={{ backgroundColor: `color-mix(in oklch, ${selectionColor} 45%, transparent)` }}
          />
          <div className="h-2 w-1/2 rounded-full bg-white/10" />
          <div className="mt-1 h-4 rounded-md border border-white/[0.07]" />
        </div>
      </div>

      {/* Dock preview */}
      <div className="mt-2 flex justify-center">
        <div
          className="flex origin-bottom items-center gap-1 rounded-full border border-white/[0.07] bg-zinc-950/80 px-2 py-1 shadow-sm"
          style={{ opacity: bottomBarOpacity, transform: `scale(${bottomBarScale})` }}
        >
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="bg-muted-foreground/50 size-1.5 rounded-full"
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  )
})

AppearancePreviewCard.displayName = 'AppearancePreviewCard'

export default AppearancePreviewCard
