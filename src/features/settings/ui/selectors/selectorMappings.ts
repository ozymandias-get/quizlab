import type { HealthTone, SelectorHealthState } from './types'

export function getHealthTone(health: SelectorHealthState): HealthTone {
  switch (health) {
    case 'ready':
      return {
        badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        border: 'border-emerald-500/20 bg-emerald-500/[0.04]'
      }
    case 'migrated':
      return {
        badge: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
        icon: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
        border: 'border-sky-500/20 bg-sky-500/[0.04]'
      }
    case 'needs_repick':
      return {
        badge: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
        icon: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        border: 'border-amber-500/20 bg-amber-500/[0.05]'
      }
    default:
      return {
        badge: 'border-white/10 bg-white/5 text-white/45',
        icon: 'border-white/10 bg-white/5 text-white/40',
        border: 'border-white/[0.06] bg-white/[0.03]'
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
