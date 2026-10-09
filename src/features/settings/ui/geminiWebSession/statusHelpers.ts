import type { GeminiWebSessionStatusView } from './types'

type GeminiWebStatusTone = 'primary' | 'success' | 'danger' | 'warning'

/**
 * Maps the session state onto a semantic tone. Used for the status glyph in the
 * session section header so the state reads without relying on hue alone (the
 * resolved `stateText` always accompanies it).
 */
const getStatusTone = (status: GeminiWebSessionStatusView): GeminiWebStatusTone => {
  if (status.isRefreshing) return 'primary'
  if (status.isAuthenticated) return 'success'
  if (status.needsReauth) return 'danger'
  return 'warning'
}

/** Icon-only colour for the neutral section-header chip. */
export const getStatusIconClass = (status: GeminiWebSessionStatusView): string => {
  switch (getStatusTone(status)) {
    case 'primary':
      return 'text-primary'
    case 'success':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'danger':
      return 'text-destructive'
    default:
      return 'text-amber-600 dark:text-amber-400'
  }
}
