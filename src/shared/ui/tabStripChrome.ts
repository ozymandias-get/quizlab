/**
 * Shared visual language for PDF + AI top tab strips:
 * semantic surface, subtle bottom border, unified pill tabs.
 */
export const TAB_STRIP_BAR_CLASS = 'relative h-11 shrink-0 border-b border-border/45 bg-muted/10'

// Overflow stays visible so the tab overflow panels can open below the row
// instead of being clipped by it. Tab counts are measured, so pills themselves
// no longer need the row to hide horizontal overflow.
export const TAB_STRIP_ROW_CLASS = 'flex h-full items-center gap-1.5 px-3'

export const TAB_STRIP_DIVIDER_CLASS = 'h-4 w-px shrink-0 bg-border/50'
