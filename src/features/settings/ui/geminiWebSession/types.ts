import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'
import type {
  GeminiWebSessionReasonCode,
  GeminiWebSessionRefreshReason,
  GeminiWebSessionState
} from '@shared-core/types'

export interface GeminiWebSessionStatusView {
  state: GeminiWebSessionState
  reason: GeminiWebSessionReasonCode
  checking: boolean
  isRefreshing: boolean
  featureEnabled: boolean
  userEnabled: boolean
  webEnabled: boolean
  isAuthenticated: boolean
  needsReauth: boolean
  isDegraded: boolean
  lastCheckAt: string | null
  lastRefreshedAt: string | null
  lastRefreshReason: GeminiWebSessionRefreshReason | null
  requiresManualLogin: boolean
  showReauthAlert: boolean
}

export interface GeminiWebSessionActionState {
  isGeminiWebLoginInProgress: boolean
  isCheckingWebNow: boolean
  isReauthingWeb: boolean
  isResettingWebProfile: boolean
  isTogglingWebEnabled: boolean
  isRefreshing: boolean
}

export interface GeminiWebSessionHandlers {
  onOpenWebLogin: () => void
  onCheckWebNow: () => void
  onReauthWeb: () => void
  onResetWebProfile: () => void
  onToggleWebEnabled: () => void
  onToggleManagedApp: (appId: GoogleWebSessionAppId) => void
}
