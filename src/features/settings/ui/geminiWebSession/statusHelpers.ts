import type { GeminiWebSessionStatusView } from './types'

export const getCardClasses = (status: GeminiWebSessionStatusView) => {
  if (!status.webEnabled) {
    return 'border-border bg-card shadow-xs'
  }
  if (status.isRefreshing) {
    return 'border-primary/30 bg-card shadow-xs'
  }
  if (status.isAuthenticated) {
    return 'border-emerald-500/30 bg-card shadow-xs'
  }
  if (status.needsReauth) {
    return 'border-destructive/30 bg-card shadow-xs'
  }
  return 'border-amber-500/30 bg-card shadow-xs'
}

export const getStatusIconContainerClass = (status: GeminiWebSessionStatusView) => {
  if (status.isRefreshing) return 'bg-primary/10 border border-primary/20'
  if (status.isAuthenticated) return 'bg-emerald-500/10 border border-emerald-500/20'
  if (status.needsReauth) return 'bg-destructive/10 border border-destructive/20'
  return 'bg-amber-500/10 border border-amber-500/20'
}
