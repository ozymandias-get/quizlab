export type NativeMessagingConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface NativeMessagingExtensionInfo {
  status: NativeMessagingConnectionStatus
  /**
   * Whether the extension has proved that it holds the pairing code.
   *
   * A separately installed extension can reach the health endpoint with its
   * pinned origin before it is paired. Only a signed request proves that the
   * user paired it, and only a paired extension can import sessions.
   */
  paired: boolean
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
