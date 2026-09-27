import { memo, type ReactNode } from 'react'

interface SettingsTabIconProps {
  children: ReactNode
  className?: string
}

/**
 * Canonical icon chip for a settings tab intro. Every tab used to hand-roll its
 * own copy of this tile, which is how the surface drifted. Mirrors the hero
 * chip recipe used by the PDF placeholder: neutral-tinted tile, 1px border,
 * soft radius, `aria-hidden` because the adjacent heading carries the meaning.
 *
 * Shared rather than settings-owned for the same reason as `SettingsSection`:
 * the tutorial center reuses it, and a cross-feature barrel import would
 * reintroduce the settings ↔ tutorial cycle.
 */
function SettingsTabIcon({ children, className = '' }: SettingsTabIconProps) {
  return (
    <span
      aria-hidden
      className={`border-border/60 bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl border ${className}`}
    >
      {children}
    </span>
  )
}

export default memo(SettingsTabIcon)
