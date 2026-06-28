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
}

export interface GeminiWebSessionActionState {
  isResettingWebProfile: boolean
  isTogglingWebEnabled: boolean
  isRefreshing: boolean
}

export interface GeminiWebSessionHandlers {
  onResetWebProfile: () => void
  onToggleWebEnabled: () => void
  onToggleManagedApp: (appId: GoogleWebSessionAppId) => void
  onInstallExtension: () => void
  onRemoveExtension: () => void
}
