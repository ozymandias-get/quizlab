/**
 * Shared visual language for PDF + AI top tab strips:
 * dark zinc surface, subtle white border, Arc/Linear-style pills.
 */
export const TAB_STRIP_BAR_CLASS =
  'app-drag-region relative h-11 min-w-0 shrink-0 border-b border-white/[0.07] bg-zinc-950/80'

// Overflow stays visible so the tab overflow panels can open below the row
// instead of being clipped by it. Tab counts are measured, so pills themselves
// no longer need the row to hide horizontal overflow.
export const TAB_STRIP_ROW_CLASS = 'flex h-full min-w-0 items-center gap-1.5 px-3'

export const TAB_STRIP_DIVIDER_CLASS = 'h-4 w-px shrink-0 bg-white/10'

/** Active tab: a readable dark slab with a hairline edge. */
export const TAB_ACTIVE_CLASS = 'border-white/[0.07] bg-zinc-800/90 text-zinc-100 shadow-sm'

/** Idle tab: low-contrast text that only gains a surface on hover. */
export const TAB_IDLE_CLASS =
  'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
