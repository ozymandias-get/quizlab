import type { HealthTone, SelectorHealthState } from './types'

/**
 * `border` drives the card surface, so it follows the interactive-card recipe
 * (idle `bg-card` + `hover:bg-white/5`) and only the border colour carries the
 * state. `badge` / `icon` stay semantic — they encode health, not decoration.
 */
export function getHealthTone(health: SelectorHealthState): HealthTone {
  switch (health) {
    case 'ready':
      return {
        badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        border: 'border-emerald-500/30 bg-zinc-900/45 hover:bg-white/5'
      }
    case 'migrated':
      return {
        badge: 'border-primary/30 bg-primary/10 text-primary',
        icon: 'border-primary/30 bg-primary/10 text-primary',
        border: 'border-primary/30 bg-zinc-900/45 hover:bg-white/5'
      }
    case 'repaired':
      return {
        badge: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
        icon: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
        border: 'border-sky-500/30 bg-zinc-900/45 hover:bg-white/5'
      }
    case 'needs_repick':
      return {
        badge: 'border-destructive/30 bg-destructive/10 text-destructive',
        icon: 'border-destructive/30 bg-destructive/10 text-destructive',
        border: 'border-destructive/30 bg-zinc-900/45 hover:bg-white/5'
      }
    default:
      return {
        badge: 'border-white/[0.07] bg-white/[0.04] text-muted-foreground',
        icon: 'border-white/[0.07] bg-white/[0.04] text-muted-foreground',
        border: 'border-white/[0.07] bg-zinc-900/45 hover:bg-white/5'
      }
  }
}

export function getHealthLabelKey(health: SelectorHealthState) {
  switch (health) {
    case 'ready':
      return 'selectors_health_ready'
    case 'migrated':
      return 'selectors_health_migrated'
    case 'repaired':
      return 'selectors_health_repaired'
    case 'needs_repick':
      return 'selectors_health_needs_repick'
    default:
      return 'selectors_health_missing'
  }
}
