/**
 * Shared visual language for PDF + AI top tab strips:
 * dark glass, thin borders, emerald active accent, pill tabs.
 */
export const TAB_STRIP_BAR_CLASS =
  'relative h-11 shrink-0 rounded-t-[1.5rem] border-b border-white/[0.05] bg-gradient-to-b from-white/[0.05] to-[#050505] shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]'

export const TAB_STRIP_ROW_CLASS = 'flex h-full items-center gap-1.5 overflow-hidden px-2.5'

const TAB_STRIP_CHROME_BTN_BASE =
  'flex shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-gradient-to-b from-white/[0.07] to-white/[0.02] text-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-emerald-500/22 hover:from-white/[0.1] hover:text-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-[0.35] disabled:hover:border-white/[0.08] disabled:hover:from-white/[0.07]'

export const TAB_STRIP_CHROME_BTN = `${TAB_STRIP_CHROME_BTN_BASE} h-8 w-8`

export const TAB_STRIP_CHROME_BTN_WIDE = `${TAB_STRIP_CHROME_BTN_BASE} h-8 min-w-9 px-1.5`

export const TAB_STRIP_DIVIDER_CLASS =
  'h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-white/18 to-transparent'
