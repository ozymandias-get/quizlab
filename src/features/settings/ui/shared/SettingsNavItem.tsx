import { motion, useReducedMotion } from 'motion/react'
import { memo } from 'react'

interface SettingsNavItemProps {
  label: string
  icon: React.ElementType
  isActive: boolean
  onClick: () => void
}

const SettingsNavItem = memo(function SettingsNavItem({
  label,
  icon: Icon,
  isActive,
  onClick
}: SettingsNavItemProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={`group focus-visible:ring-ring/40 motion-normal relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 ${
        isActive
          ? 'bg-accent/40 text-foreground font-semibold'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="active-sidebar-indicator"
          className="bg-ring pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full"
          transition={
            prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 35 }
          }
        />
      )}
      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        <Icon
          className={`h-4 w-4 transition-colors ${
            isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
          }`}
        />
      </div>
      <span
        className={`motion-normal tracking-ql-label text-ql-12 block truncate font-medium transition-colors ${
          isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
        }`}
      >
        {label}
      </span>
    </button>
  )
})

export default SettingsNavItem
