export type NativeMessagingConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * One installed copy of the extension.
 *
 * Chrome keeps `chrome.storage.local` separate per profile, so every profile
 * gets its own extension instance with its own profile id and its own
 * user-chosen name. The app can talk to all of them at once and has to know
 * which one the user selected as the cookie source.
 */
export interface NativeMessagingExtensionProfile {
  id: string
  /** The name the user gave this Chrome profile in the extension popup. */
  name: string
  connected: boolean
  paired: boolean
  protocolVersion: number | null
  selected: boolean
}

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
  /** Every extension instance the app has heard from. */
  profiles: NativeMessagingExtensionProfile[]
  /** The profile whose cookies are imported, or null before the first one. */
  selectedProfileId: string | null
}

export interface NativeMessagingProfileSelectionResult {
  success: boolean
  error?: 'unknown_profile' | 'write_failed' | 'wipe_failed' | 'Unauthorized'
  /**
   * Sites whose sessions were cleared before the switch could not be
   * completed. The selection may still point at the old profile; these sites
   * have to be imported again by that profile.
   */
  clearedSiteIds?: string[]
  /** Enabled sites whose sessions could not be cleared. */
  failedSiteIds?: string[]
  /**
   * Whether part of the work happened: some sessions were cleared, or all
   * were cleared but the new selection could not be written. The operation is
   * not atomic and the caller must not present it as one.
   */
  partial?: boolean
  /**
   * Whether the old profile was asked to push the cleared sites again.
   *
   * The app cannot read Chrome itself; the recovery is the extension's next
   * poll. A failure to request it is not fatal, but the cleared sites then
   * stay signed out until the user syncs manually.
   */
  reimportRequested?: boolean
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
