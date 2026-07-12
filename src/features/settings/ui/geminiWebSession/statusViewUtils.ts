import type { GeminiWebSessionRefreshReason } from '@shared-core/types'

import type { GeminiWebSessionStatusView } from './types'

export interface StatusViewInput {
  state: string
  reason: string
  checking: boolean
  isRefreshing: boolean
  featureEnabled: boolean
  userEnabled: boolean
  lastCheckAt: string | null
  lastRefreshedAt: string | null
  lastRefreshReason: GeminiWebSessionRefreshReason | null
}

export function createStatusView(input: StatusViewInput): GeminiWebSessionStatusView {
  const webEnabled = input.featureEnabled && input.userEnabled
  const needsReauth = input.state === 'reauth_required'

  return {
    state: input.state as GeminiWebSessionStatusView['state'],
    reason: input.reason as GeminiWebSessionStatusView['reason'],
    checking: input.checking,
    isRefreshing: input.isRefreshing,
    featureEnabled: input.featureEnabled,
    userEnabled: input.userEnabled,
    webEnabled,
    isAuthenticated: input.state === 'authenticated',
    needsReauth,
    isDegraded: input.state === 'degraded',
    lastCheckAt: input.lastCheckAt,
    lastRefreshedAt: input.lastRefreshedAt,
    lastRefreshReason: input.lastRefreshReason
  }
}

export function computeReasonText(reason: string, t: (key: string) => string): string {
  const reasonKey = `gws_reason_${reason}`
  const translated = t(reasonKey)
  return translated === reasonKey ? reason : translated
}

export function computeRefreshReasonText(
  lastRefreshReason: GeminiWebSessionRefreshReason | null,
  t: (key: string) => string
): string | null {
  if (!lastRefreshReason) return null
  const reasonKey = `gws_refresh_reason_${lastRefreshReason}`
  const translated = t(reasonKey)
  return translated === reasonKey ? lastRefreshReason : translated
}

export function computeStateText(
  status: GeminiWebSessionStatusView,
  t: (key: string) => string
): string {
  if (!status.featureEnabled) return t('gws_feature_disabled')
  if (!status.userEnabled) return t('gws_state_disabled')
  if (status.isRefreshing) return t('gws_state_refreshing')
  if (status.isAuthenticated) return t('gws_state_authenticated')
  if (status.needsReauth) return t('gws_state_reauth_required')
  if (status.isDegraded) return t('gws_state_degraded')
  return t('gws_state_auth_required')
}
