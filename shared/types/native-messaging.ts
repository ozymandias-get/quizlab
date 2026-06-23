export type NativeMessagingConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface NativeMessagingExtensionInfo {
  status: NativeMessagingConnectionStatus
  installed: boolean
  error?: string
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

export interface NativeMessagingCookieMessage {
  type: 'SESSION_COOKIES'
  cookies: ChromeExtensionCookie[]
  accountHash?: string
  timestamp: number
}

export interface NativeMessagingHealthMessage {
  type: 'SESSION_HEALTH'
  healthy: boolean
  expiresAt?: number
  timestamp: number
}

export interface NativeMessagingRefreshRequest {
  type: 'REQUEST_COOKIE_REFRESH'
  reason: string
  timestamp: number
}

export interface NativeMessagingAck {
  type: 'ACK'
  status: string
  error?: string
  timestamp: number
}

export type NativeMessagingHostMessage = NativeMessagingCookieMessage | NativeMessagingHealthMessage

export type NativeMessagingExtensionMessage = NativeMessagingRefreshRequest | NativeMessagingAck
