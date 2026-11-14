import type {
  NativeMessagingConnectionStatus,
  NativeMessagingExtensionInfo,
  NativeMessagingExtensionProfile
} from '@shared-core/types'

import crypto from 'crypto'
import { BrowserWindow } from 'electron'
import http from 'http'
import type { AddressInfo } from 'net'

import { QUIZLAB_EXTENSION_ORIGIN } from '../../../shared/constants/extensionRelease.js'
import { APP_CONFIG } from '../../app/constants.js'
import { Logger } from '../../core/logger.js'
import { createBridgeRequestHandler } from './nativeMessagingBridgeHandler.js'
import { NativeMessagingCredentials } from './nativeMessagingCredentials.js'
import {
  isProfileId,
  NativeMessagingProfileStore,
  normalizeProfileName,
  type PersistedExtensionProfile
} from './nativeMessagingProfiles.js'
import { BRIDGE_PORT, BRIDGE_PORT_RANGE_END } from './nativeMessagingTypes.js'

/**
 * What the app knows about one Chrome profile's extension.
 *
 * The state is keyed by the profile id the extension generates and persists in
 * its own `chrome.storage.local`: Chrome gives every profile a separate store,
 * so each profile yields a different id even though the extension files are the
 * same.
 */
interface ExtensionProfileState {
  id: string
  name: string
  connected: boolean
  paired: boolean
  protocolVersion: number | null
  lastSeenAt: number
}

/** The default name of a profile the user has not named yet. */
const DEFAULT_PROFILE_NAME = 'Chrome'

class NativeMessagingManager {
  private httpServer: http.Server | null = null
  private _connectionStatus: NativeMessagingConnectionStatus = 'disconnected'
  private _port: number = BRIDGE_PORT
  private _paired = false
  private _waitingSince: number | null = null
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private _sharedSecret: string = crypto.randomBytes(32).toString('hex')
  private readonly _instanceId: string = crypto.randomBytes(16).toString('hex')
  private _extensionLastSeenAt: number = 0
  private _legacyConnectedAt: number = 0
  private _extensionProtocolVersion: number | null = null
  private _expectedExtensionOrigin: string | null = null
  private readonly _profileStore = new NativeMessagingProfileStore()
  private readonly _profiles = new Map<string, ExtensionProfileState>()
  private _selectedProfileId: string | null = null
  private _selectionVersion: number = 0
  private _selectionChangeDepth: number = 0
  private _profilesPersistenceError: string | null = null
  private _profilesWrite: Promise<void> = Promise.resolve()
  /**
   * The selection writers that are running, one at a time.
   *
   * A pairing, a user click and a restart recovery all change the same two
   * values. Serializing them is what keeps the memory and the disk from
   * disagreeing: every writer persists first and commits after its own write,
   * so the last committed write is the only state either side holds.
   */
  private _selectionWrite: Promise<unknown> = Promise.resolve()

  get connectionStatus(): NativeMessagingConnectionStatus {
    return this._connectionStatus
  }

  get port(): number {
    return this._port
  }

  /** Identifies this running bridge; the health answer carries it. */
  get instanceId(): string {
    return this._instanceId
  }

  getExtensionInfo(): NativeMessagingExtensionInfo {
    const selectedProfileId = this.getSelectedProfileId()
    const selected = selectedProfileId ? this._profiles.get(selectedProfileId) : undefined
    const status = this.deriveStatus()
    const legacyActive = this.isLegacyConnected()
    const paired = selected?.connected
      ? selected.paired
      : legacyActive
        ? this._paired
        : (selected?.paired ?? this._paired)
    const profiles: NativeMessagingExtensionProfile[] = [...this._profiles.values()]
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        connected: profile.connected,
        paired: profile.paired,
        protocolVersion: profile.protocolVersion,
        selected: profile.id === selectedProfileId
      }))
      .sort((left, right) => {
        if (left.selected !== right.selected) return left.selected ? -1 : 1
        return left.name.localeCompare(right.name)
      })

    return {
      status,
      paired,
      error: status === 'error' ? 'Bridge server not running' : undefined,
      waitingSince: this._waitingSince,
      userHint: this.computeUserHint(status),
      profiles,
      selectedProfileId,
      ...(this._profilesPersistenceError
        ? { profilePersistenceError: this._profilesPersistenceError }
        : {})
    }
  }

  /**
   * The profile whose cookies the app imports.
   *
   * An explicit selection survives restarts. Before the user picked one, the
   * first profile the app heard from is used, which keeps a single-profile
   * setup working without an extra step.
   */
  getSelectedProfileId(): string | null {
    // The selection is materialized when a profile first pairs, not derived
    // from whichever profile happens to be connected. A live fallback would
    // silently switch the cookie source when a Chrome window closes.
    return this._selectedProfileId
  }

  /** The revision the extension compares to notice a selection change. */
  getSelectionVersion(): number {
    return this._selectionVersion
  }

  /**
   * Whether the app is clearing the sessions of the previous profile.
   *
   * While this is true the bridge refuses cookie packets: a packet from the
   * newly selected profile could otherwise land between the switch and the
   * wipe and be deleted by it.
   */
  beginSelectionChange(): void {
    this._selectionChangeDepth += 1
  }

  endSelectionChange(): void {
    this._selectionChangeDepth = Math.max(0, this._selectionChangeDepth - 1)
  }

  isSelectionChanging(): boolean {
    return this._selectionChangeDepth > 0
  }

  /** Whether the app has heard from this profile. */
  hasProfile(profileId: string): boolean {
    return isProfileId(profileId) && this._profiles.has(profileId.trim())
  }

  /**
   * Selects the Chrome profile to take cookies from.
   *
   * The selection is written to disk before it is committed to memory and
   * before it is reported: the bridge accepts packets for whatever
   * `getSelectedProfileId()` says, so a memory-first switch would accept the
   * new profile's packets against a selection a restart never saw. A profile
   * that has not contacted the app yet cannot be selected.
   */
  selectProfile(profileId: string): Promise<boolean> {
    return this.runSelectionWrite(async () => {
      if (!this.hasProfile(profileId)) return false
      const id = profileId.trim()
      if (this._selectedProfileId === id) return true

      const nextVersion = this._selectionVersion + 1
      try {
        await this.persistProfiles({ selectedProfileId: id, selectionVersion: nextVersion })
      } catch (error) {
        // Nothing was committed: the previous source stays authoritative, both
        // in memory and on disk.
        Logger.warn('[NativeMessaging] The profile selection could not be saved:', error)
        return false
      }
      this._selectedProfileId = id
      this._selectionVersion = nextVersion
      // The status page shows which profile is selected; the event makes it
      // refetch without waiting for its poll.
      this.broadcastExtensionConnected()
      return true
    })
  }

  /** Runs one selection write after the previous one finished. */
  private runSelectionWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = this._selectionWrite.catch(() => undefined).then(task)
    this._selectionWrite = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  /** The live status of the profile the user selected. */
  private selectedProfileState(): ExtensionProfileState | undefined {
    const id = this.getSelectedProfileId()
    return id ? this._profiles.get(id) : undefined
  }

  /** Whether a protocol-2 extension is currently talking to the app. */
  private isLegacyConnected(): boolean {
    return this._legacyConnectedAt > 0 && Date.now() - this._legacyConnectedAt <= 120000
  }

  /** The status of the selected profile, or the legacy single-extension state. */
  private deriveStatus(): NativeMessagingConnectionStatus {
    const selected = this.selectedProfileState()
    if (selected?.connected) return 'connected'
    if (this.isLegacyConnected()) return 'connected'
    if ([...this._profiles.values()].some((profile) => profile.connected)) return 'connecting'

    // Before the first profile-aware request the old single-extension state is
    // still the only thing the app knows.
    if (this._profiles.size === 0) return this._connectionStatus
    if (this._connectionStatus === 'error') return 'error'
    if (this._connectionStatus === 'connecting' && this._extensionLastSeenAt === 0) {
      return 'connecting'
    }
    return 'disconnected'
  }

  /**
   * The code the user copies into the extension popup.
   *
   * It is the signing secret itself. The settings UI shows it behind an
   * explicit action; it never travels on the HTTP bridge.
   */
  getPairingCode(): string {
    return this._sharedSecret
  }

  /**
   * The protocol version the extension reported, or null when it reported none.
   *
   * The extension names the protocol it speaks in every request it makes to
   * the bridge. An extension that reports nothing is an extension the user
   * has to reload: it may be an old copy that predates the handshake.
   */
  getExtensionProtocolVersion(): number | null {
    const selected = this.selectedProfileState()
    if (selected?.connected) return selected.protocolVersion
    if (this.isLegacyConnected()) return this._extensionProtocolVersion
    return selected?.protocolVersion ?? this._extensionProtocolVersion
  }

  /**
   * Forgets the protocol version of the extension that is gone.
   *
   * A version that outlived its extension would tell the settings page that
   * an extension is ready while none is talking to the app.
   */
  private forgetExtensionProtocolVersion(): void {
    this._extensionProtocolVersion = null
    for (const profile of this._profiles.values()) profile.protocolVersion = null
  }

  private computeUserHint(status: NativeMessagingConnectionStatus): string | null {
    if (status !== 'connecting') return null
    if (!this._waitingSince) return 'waiting'

    const elapsed = Date.now() - this._waitingSince
    if (elapsed > 30000) {
      return 'waiting_long'
    }
    return 'waiting'
  }

  /**
   * Remembers that the extension is talking to the app.
   *
   * The connection is kept alive by the traffic itself: the extension pushes
   * its packets only when something changed, so the app learns that the
   * extension is there from the requests that arrive, not from a heartbeat of
   * its own. The bridge calls this for every request that passed the origin
   * check.
   */
  markExtensionSeen(profileId?: string, profileName?: string): void {
    const now = Date.now()
    this._extensionLastSeenAt = now

    if (!isProfileId(profileId)) {
      // A request from an extension that predates profile identities. Keeping
      // the old state means the settings page can still say "outdated" instead
      // of "not connected".
      this._legacyConnectedAt = now
      const wasConnected = this._connectionStatus === 'connected'
      if (wasConnected) return
      this._connectionStatus = 'connected'
      this._waitingSince = null
      this.broadcastExtensionConnected()
      return
    }

    const id = profileId.trim()
    const name = normalizeProfileName(profileName) || DEFAULT_PROFILE_NAME
    let profile = this._profiles.get(id)
    const isNew = !profile
    let nameChanged = false
    if (!profile) {
      profile = {
        id,
        name,
        connected: true,
        paired: false,
        protocolVersion: null,
        lastSeenAt: now
      }
      this._profiles.set(id, profile)
    } else {
      profile.lastSeenAt = now
      const wasDisconnected = !profile.connected
      profile.connected = true
      if (name && profile.name !== name) {
        profile.name = name
        nameChanged = true
      }
      if (!wasDisconnected && !isNew && !nameChanged) {
        // Nothing visible changed. The liveness is remembered, the renderer
        // does not need an event for every poll.
        this._connectionStatus = 'connected'
        this._waitingSince = null
        return
      }
    }

    this._connectionStatus = 'connected'
    this._waitingSince = null
    if (isNew || nameChanged) {
      void this.persistProfiles().catch((error) => {
        Logger.warn('[NativeMessaging] The Chrome profile list could not be saved:', error)
      })
    }
    this.broadcastExtensionConnected()
  }

  /**
   * Remembers that the extension proved it holds the pairing code.
   *
   * The settings page uses this to tell an extension that is installed but
   * not paired from one that is ready to import.
   */
  async markExtensionPaired(profileId?: string): Promise<void> {
    if (isProfileId(profileId)) {
      const profile = this._profiles.get(profileId.trim())
      if (!profile) {
        // A valid id the app has never seen is not a legacy request: falling
        // through would set the old single-extension flag and report a profile
        // that is not there as paired.
        return
      }
      profile.paired = true
      // The first profile that proves it holds the pairing code becomes the
      // source. Pinning it here is what keeps a later disconnect from silently
      // moving the source to the other Chrome profile.
      if (this._selectedProfileId) return
      await this.runSelectionWrite(async () => {
        // A concurrent pairing or the user may have committed a source while
        // this one was waiting: the first committed source stays.
        if (this._selectedProfileId) return
        const nextVersion = this._selectionVersion + 1
        try {
          await this.persistProfiles({
            selectedProfileId: profile.id,
            selectionVersion: nextVersion
          })
        } catch (error) {
          // Leave the selection unset. The next signed request retries; the
          // settings page keeps showing "no source selected" in the meantime.
          Logger.warn('[NativeMessaging] The initial profile selection could not be saved:', error)
          return
        }
        this._selectedProfileId = profile.id
        this._selectionVersion = nextVersion
        this.broadcastExtensionConnected()
      })
      return
    }
    // A legacy request proves the old extension holds the secret, but it is
    // not a request from the selected profile: only that profile's own signed
    // request may mark it paired.
    this._paired = true
  }

  /**
   * Remembers the protocol version named by one extension instance.
   *
   * A request without a profile id comes from an extension that predates the
   * profile handshake; its version is kept in the old single-extension slot so
   * the settings page can still report it as outdated.
   */
  recordExtensionProtocolVersion(profileId: string | undefined, version: number): void {
    if (isProfileId(profileId)) {
      const profile = this._profiles.get(profileId.trim())
      if (profile) {
        profile.protocolVersion = version
        return
      }
    }
    this._extensionProtocolVersion = version
  }

  async initialize(): Promise<void> {
    // The secret is persisted once and paired with the extension by hand. It
    // is never handed out over HTTP: an HTTP response can be read by any local
    // process that can forge the Origin header, which would defeat the
    // signature it is supposed to enable.
    this._sharedSecret = await NativeMessagingCredentials.loadOrCreateSharedSecret()
    this._expectedExtensionOrigin = QUIZLAB_EXTENSION_ORIGIN
    await this.loadProfiles()
    Logger.info(`[NativeMessaging] Expected extension origin: ${this._expectedExtensionOrigin}`)
    await this.startServer()
  }

  /**
   * Reads the names and the selection from the last run.
   *
   * A profile that is not running right now starts disconnected. The selection
   * is kept even while its profile is away, so a restart does not silently
   * switch the cookie source to another Chrome profile.
   */
  private async loadProfiles(): Promise<void> {
    const stored = await this._profileStore.load()
    this._selectedProfileId = stored.selectedProfileId
    this._selectionVersion = stored.selectionVersion
    for (const profile of stored.profiles) {
      if (this._profiles.has(profile.id)) continue
      this._profiles.set(profile.id, {
        id: profile.id,
        name: profile.name,
        connected: false,
        paired: false,
        protocolVersion: null,
        lastSeenAt: 0
      })
    }
  }

  /**
   * Writes the names and the selection, one write at a time.
   *
   * The snapshot is built when the write runs, not when it is queued: a name
   * change that was queued before a selection was committed must not write the
   * old selection back to disk after the new one landed. Only the caller that
   * commits a selection passes it explicitly; every other write carries the
   * state that is committed at that moment.
   */
  private persistProfiles(selection?: {
    selectedProfileId: string | null
    selectionVersion: number
  }): Promise<void> {
    this._profilesWrite = this._profilesWrite
      .catch(() => undefined)
      .then(() => {
        const profiles: PersistedExtensionProfile[] = [...this._profiles.values()].map(
          (profile) => ({ id: profile.id, name: profile.name })
        )
        const state = selection ?? {
          selectedProfileId: this._selectedProfileId,
          selectionVersion: this._selectionVersion
        }
        return this.saveProfileSnapshot({
          version: 1 as const,
          selectedProfileId: state.selectedProfileId,
          selectionVersion: state.selectionVersion,
          profiles
        })
      })
    return this._profilesWrite
  }

  /**
   * Saves the profile list with one retry.
   *
   * A failed write used to be logged and forgotten; the renderer then showed a
   * name that the next start would not have. The retry covers a transient
   * lock, and a permanent failure is exposed through `getExtensionInfo()`
   * instead of being invisible.
   */
  private async saveProfileSnapshot(snapshot: {
    version: 1
    selectedProfileId: string | null
    selectionVersion: number
    profiles: PersistedExtensionProfile[]
  }): Promise<void> {
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this._profileStore.save(snapshot)
        this._profilesPersistenceError = null
        return
      } catch (error) {
        lastError = error
      }
    }
    this._profilesPersistenceError =
      lastError instanceof Error ? lastError.message : String(lastError)
    throw lastError
  }

  private startServer(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.httpServer?.listening) {
        resolve()
        return
      }

      const server = http.createServer(createBridgeRequestHandler(this))
      this.httpServer = server

      server.listen(this._port, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo
        this._port = addr?.port || this._port
        this._connectionStatus = 'connecting'
        this._waitingSince = Date.now()
        this.startHealthCheck()
        resolve()
      })

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          // The failed instance is no longer usable: close it and drop its
          // listeners before trying the next port. A callback is passed to
          // close() because a server that never listened would otherwise emit
          // an unhandled `error` event after its listeners were removed.
          this.disposeFailedServer(server)

          if (this._port >= BRIDGE_PORT_RANGE_END) {
            Logger.error(
              `[NativeMessaging] No available port in range ${BRIDGE_PORT}-${BRIDGE_PORT_RANGE_END}`
            )
            this._connectionStatus = 'error'
            this._waitingSince = null
            resolve()
            return
          }

          this._port++
          this.startServer().then(resolve)
          return
        }

        this._connectionStatus = 'error'
        this._waitingSince = null
        resolve()
      })
    })
  }

  /** Closes a server that could not bind and empties the manager's slot. */
  private disposeFailedServer(server: http.Server): void {
    if (this.httpServer === server) this.httpServer = null
    try {
      server.close(() => {
        try {
          server.removeAllListeners()
        } catch {
          // Non-EventEmitter test doubles.
        }
      })
    } catch {
      try {
        server.removeAllListeners()
      } catch {
        // Already disposed.
      }
    }
  }

  stopServer(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    if (this.httpServer) {
      const server = this.httpServer
      this.httpServer = null
      try {
        server.close()
      } catch {
        // close() on an already-closing server must not break dispose()
      }
      // Listener cleanup must never skip the close() above: a throwing
      // removeAllListeners would otherwise leak the server (and break
      // consumers whose server doubles lack the EventEmitter API).
      try {
        server.removeAllListeners()
      } catch {
        // Non-EventEmitter server doubles or already-disposed servers.
      }
    }
    this._connectionStatus = 'disconnected'
    this._waitingSince = null
    this._legacyConnectedAt = 0
    for (const profile of this._profiles.values()) profile.connected = false
    this.forgetExtensionProtocolVersion()
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval)

    this.healthCheckInterval = setInterval(() => {
      const now = Date.now()

      if (this._profiles.size > 0) {
        let lostOne = false
        for (const profile of this._profiles.values()) {
          if (!profile.connected) continue
          if (now - profile.lastSeenAt <= 120000) continue
          profile.connected = false
          profile.protocolVersion = null
          lostOne = true
        }
        if (![...this._profiles.values()].some((profile) => profile.connected)) {
          this._connectionStatus = 'disconnected'
          this._waitingSince = null
        }
        if (lostOne) this.broadcastExtensionDisconnected()
        return
      }

      const elapsed = now - this._extensionLastSeenAt

      if (this._connectionStatus === 'connected' && elapsed > 120000) {
        this._connectionStatus = 'connecting'
        this._waitingSince = Date.now()
        this.forgetExtensionProtocolVersion()
        this.broadcastExtensionDisconnected()
      }

      if (this._connectionStatus === 'connecting' && elapsed > 120000) {
        this._connectionStatus = 'disconnected'
        this._waitingSince = null
      }
    }, 30000)
  }

  private broadcastExtensionConnected(): void {
    const allWindows = BrowserWindow.getAllWindows()
    for (const win of allWindows) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_CONNECTED)
      }
    }
  }

  broadcastExtensionDisconnected(): void {
    const allWindows = BrowserWindow.getAllWindows()
    for (const win of allWindows) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(APP_CONFIG.IPC_CHANNELS.NATIVE_MESSAGING_EXTENSION_DISCONNECTED)
      }
    }
  }

  dispose(): void {
    this.stopServer()
  }
}

export const nativeMessagingManager = new NativeMessagingManager()
