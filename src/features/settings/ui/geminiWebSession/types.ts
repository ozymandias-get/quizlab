import type { GoogleWebSessionAppId } from '@shared-core/constants/google-ai-web-apps'

export interface GeminiWebSessionStatusView {
  state: string
  reason: string
  checking: boolean
  featureEnabled: boolean
  userEnabled: boolean
  webEnabled: boolean
  isAuthenticated: boolean
  needsReauth: boolean
  isDegraded: boolean
  lastCheckAt: string | null
}

export interface GeminiWebSessionActionState {
  isGeminiWebLoginInProgress: boolean
  isCheckingWebNow: boolean
  isReauthingWeb: boolean
  isResettingWebProfile: boolean
  isTogglingWebEnabled: boolean
}

export interface GeminiWebSessionHandlers {
  onOpenWebLogin: () => void
  onCheckWebNow: () => void
  onReauthWeb: () => void
  onResetWebProfile: () => void
  onToggleWebEnabled: () => void
  onToggleManagedApp: (appId: GoogleWebSessionAppId) => void
}
