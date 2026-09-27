import type { HealthTone, SelectorHealthState } from './types'

/**
 * Health tone.
 *
 * `border` drives the card surface, so it follows the interactive-card recipe
 * (idle `bg-card` + `hover:bg-muted/50`) and only the border colour carries the
 * state. `badge` / `icon` stay semantic — they encode health, not decoration.
 */
export function getHealthTone(health: SelectorHealthState): HealthTone {
  switch (health) {
    case 'ready':
      return {
        badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/30 bg-card hover:bg-muted/50'
      }
    case 'migrated':
      return {
        badge: 'border-primary/30 bg-primary/10 text-primary',
        icon: 'border-primary/30 bg-primary/10 text-primary',
        border: 'border-primary/30 bg-card hover:bg-muted/50'
      }
    case 'repaired':
      return {
        badge: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
        icon: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
        border: 'border-sky-500/30 bg-card hover:bg-muted/50'
      }
    case 'needs_repick':
      return {
        badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        icon: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/30 bg-card hover:bg-muted/50'
      }
    default:
      return {
        badge: 'border-border/60 bg-muted text-muted-foreground',
        icon: 'border-border/60 bg-muted text-muted-foreground',
        border: 'border-border/60 bg-card hover:bg-muted/50'
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
