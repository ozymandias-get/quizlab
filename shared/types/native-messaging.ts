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


