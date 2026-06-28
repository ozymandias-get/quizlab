export type NativeMessagingConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface NativeMessagingExtensionInfo {
  status: NativeMessagingConnectionStatus
  installed: boolean
  error?: string
  /** Timestamp (ms) when the connecting state began, or null. */
  waitingSince: number | null
  /** Localized hint text shown to the user when waiting. */
  userHint: string | null
}

export interface ChromeExtensionCookie {
  name: string
  value: string
  domain: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'no_restriction' | 'unspecified'
  expires?: number
}
