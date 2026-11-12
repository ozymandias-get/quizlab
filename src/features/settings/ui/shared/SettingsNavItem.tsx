import { cn } from '@shared/lib/uiUtils'
import { WithTooltip } from '@shared/ui/components/primitives'

import { motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'

interface SettingsNavItemProps {
  label: string
  icon: React.ElementType
  /** Tab this row switches to; paired with a stable `onSelect` keeps memo effective. */
  tabId: string
  isActive: boolean
  onSelect: (tabId: string) => void
  /** Icon-only rail used when the settings window is too narrow. */
  compact?: boolean
}

const SettingsNavItem = memo(function SettingsNavItem({
  label,
  icon: Icon,
  tabId,
  isActive,
  onSelect,
  compact = false
}: SettingsNavItemProps) {
  const prefersReducedMotion = useReducedMotion()

  const item = (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onSelect(tabId)}
      className={`group focus-visible:ring-ring/70 motion-normal relative flex min-h-9 w-full items-center rounded-lg py-2 text-left transition-colors outline-none focus-visible:ring-2 ${
        compact ? 'justify-center px-0' : 'gap-2.5 px-3'
      } ${
        isActive
          ? 'bg-accent/40 text-foreground font-semibold'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="active-sidebar-indicator"
          style={{ backgroundColor: 'var(--selection-color-source, oklch(var(--ring)))' }}
          className="bg-ring pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full"
          transition={
            prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 35 }
          }
        />
      )}
      {/* One icon contract for the whole rail: same 18px box, same 1.75
          stroke. Active items get a soft solid fill behind the glyph in
          addition to the accent line, so they read at a glance. */}
      <div
        className={cn(
          'flex size-[18px] shrink-0 items-center justify-center rounded-[5px] transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'bg-transparent'
        )}
      >
        <Icon
          strokeWidth={1.75}
          className={cn(
            'size-[18px] transition-colors',
            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
          )}
        />
      </div>
      <span
        className={
          compact
            ? 'sr-only'
            : `motion-normal tracking-ql-label text-ql-12 min-w-0 truncate font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
              }`
        }
      >
        {label}
      </span>
    </button>
  )

  // Tooltips exist for the icon-only rail. On the expanded rail the label is
  // already on screen, so a hover bubble only repeats it.
  return compact ? <WithTooltip label={label}>{item}</WithTooltip> : item
})

export default SettingsNavItem
