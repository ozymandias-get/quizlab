import type { HealthTone, SelectorHealthState } from './types'

export function getHealthTone(health: SelectorHealthState): HealthTone {
  switch (health) {
    case 'ready':
      return {
        badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/20 bg-card'
      }
    case 'migrated':
      return {
        badge: 'border-primary/30 bg-primary/10 text-primary',
        icon: 'border-primary/30 bg-primary/10 text-primary',
        border: 'border-primary/20 bg-card'
      }
    case 'needs_repick':
      return {
        badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        icon: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/20 bg-card'
      }
    default:
      return {
        badge: 'border-border bg-muted/60 text-muted-foreground',
        icon: 'border-border bg-muted text-muted-foreground',
        border: 'border-border bg-card'
      }
  }
}

export function getHealthLabelKey(health: SelectorHealthState) {
  switch (health) {
    case 'ready':
      return 'selectors_health_ready'
    case 'migrated':
      return 'selectors_health_migrated'
    case 'needs_repick':
      return 'selectors_health_needs_repick'
    default:
      return 'selectors_health_missing'
  }
}
