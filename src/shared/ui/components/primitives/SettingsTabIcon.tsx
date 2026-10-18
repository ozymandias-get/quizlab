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
 */
function SettingsTabIcon({ children, className = '' }: SettingsTabIconProps) {
  return (
    <span
      aria-hidden
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${className}`}
      style={{
        color: 'var(--selection-color-source, oklch(var(--foreground)))',
        backgroundColor:
          'color-mix(in srgb, var(--selection-color-source, oklch(var(--muted))) 12%, transparent)',
        borderColor:
          'color-mix(in srgb, var(--selection-color-source, oklch(var(--border))) 24%, transparent)'
      }}
    >
      {children}
    </span>
  )
}

export default memo(SettingsTabIcon)
