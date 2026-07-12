import type { GeminiWebSessionStatusView } from './types'

export const getCardClasses = (status: GeminiWebSessionStatusView) => {
  if (!status.webEnabled) {
    return 'border-white/10 bg-gradient-to-r from-slate-500/10 to-zinc-500/10'
  }
  if (status.isRefreshing) {
    return 'border-sky-500/20 bg-gradient-to-r from-sky-500/10 to-cyan-500/10'
  }
  if (status.isAuthenticated) {
    return 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-green-500/10'
  }
  if (status.needsReauth) {
    return 'border-rose-500/20 bg-gradient-to-r from-rose-500/10 to-red-500/10'
  }
  return 'border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10'
}

export const getStatusIconContainerClass = (status: GeminiWebSessionStatusView) => {
  if (status.isRefreshing) return 'bg-sky-500/20'
  if (status.isAuthenticated) return 'bg-emerald-500/20'
  if (status.needsReauth) return 'bg-rose-500/20'
  return 'bg-amber-500/20'
}
