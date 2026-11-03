/**
 * The renderer-facing side of the per-site session import.
 *
 * The settings page asks this service three questions: which sites exist and
 * what state they are in, may a site take its session from Chrome, and may
 * the session of a site be forgotten. The service answers them and nothing
 * else: the rules about what may be imported live in the bridge core, the
 * rules about the state live in the config, and the rules about what a wipe
 * touches live in the wipe.
 *
 * Two rules matter here:
 *
 *   - Turning a site's switch off writes the switch *first* and wipes the
 *     session afterwards, so that the site is signed out again. The wipe runs
 *     under the lock of the site, and so does the import of that site: the
 *     wipe therefore always happens after the last write to the site, and a
 *     packet that arrives after the switch was written is refused by the
 *     bridge core, which reads the switch once more right before it writes a
 *     cookie.
 *   - A switch that could not be written is reported as a failure. The app
 *     must not tell the user that a site was switched off while it is still
 *     importing it.
 */
import type { Session } from 'electron'
import { session as electronSession } from 'electron'

import {
  GOOGLE_AI_WEB_SESSION_PARTITION,
  GOOGLE_AI_WEB_SITE_ID
} from '../../../shared/constants/googleAiWebApps.js'
import {
  googleAccountSlotOptions,
  isSiteSessionSlot,
  SITE_SESSION_SLOTS
} from '../../../shared/constants/siteSessionSlots.js'
import type {
  SiteSessionActionResult,
  SiteSessionListResult
} from '../../../shared/types/siteSession.js'
import { Logger } from '../../core/logger.js'
import { nativeMessagingManager } from '../native-messaging/nativeMessagingManager.js'
import { getGoogleAccountSlots, peekGoogleAccountSlots } from './googleAccounts.js'
import { ensureGoogleSessionSlot } from './googleSessionSlot.js'
import { hasLocalSessionForTarget, SITE_SESSION_PROTOCOL_VERSION } from './siteSessionBridge.js'
import { broadcastSiteSessionsChanged } from './siteSessionBroadcast.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import {
  invalidateSiteSessionListCache,
  readCachedSiteSessionList,
  siteSessionListGeneration,
  writeCachedSiteSessionList
} from './siteSessionListCache.js'
import { withSiteSessionLock } from './siteSessionLock.js'
import { partitionExistsOnDisk } from './siteSessionPartitions.js'
import { deriveSiteSessionStatus } from './siteSessionStatus.js'
import {
  buildSiteSessionTargets,
  partitionForTargetSlot,
  type SiteSessionTargetRow,
  toSiteSessionView
} from './siteSessionTargets.js'
import { wipeSiteSession } from './siteSessionWipe.js'

/**
 * The parts of the app the service works with.
 *
 * They are injected so that the service can be tested without touching the
 * user's real sessions, and so that the caller that owns the state decides
 * where it is read from.
 */
export interface SiteSessionServiceDeps {
  config: Pick<SiteSessionConfig, 'read' | 'setEnabled' | 'resetResults'> &
    Partial<Pick<SiteSessionConfig, 'setActiveSlot' | 'isEnabled' | 'recordResult'>>
  loadTargets: () => Promise<SiteSessionTargetRow[]>
  resolveSession: (partition: string) => Session
  isExtensionConnected: () => boolean
  isExtensionVersionOk: () => boolean
}

export class SiteSessionService {
  private readonly deps: SiteSessionServiceDeps

  constructor(deps: SiteSessionServiceDeps) {
    this.deps = deps
  }

  /**
   * The sites and their states.
   *
   * The partition of a site never leaves this method: the renderer gets the
   * label, the hostname, the switch and the status — nothing that would let
   * it address a session of its own.
   *
   * The answer is kept for a couple of seconds: the settings page and the
   * button in the bottom bar ask for the list at the same time, and building
   * it reads the session of every site. The cache is dropped by everything
   * that changes the answer — a switch, a clear, an import.
   */
  async list(): Promise<SiteSessionListResult> {
    const cached = readCachedSiteSessionList()
    if (cached) return cached

    for (let attempt = 0; ; attempt++) {
      const generation = siteSessionListGeneration()
      const list = await this.buildList()
      if (generation === siteSessionListGeneration()) {
        writeCachedSiteSessionList(list)
        return list
      }
      // Avoid caching an obsolete snapshot during a continuous stream of changes.
      if (attempt >= 2) return list
    }
  }

  /** The list of the sites, read from the state and from the sessions. */
  private async buildList(): Promise<SiteSessionListResult> {
    const [targets, state] = await Promise.all([this.deps.loadTargets(), this.deps.config.read()])
    const extensionConnected = this.deps.isExtensionConnected()
    const extensionVersionOk = this.deps.isExtensionVersionOk()

    const views = await Promise.all(
      targets.map(async (target) => {
        const targetState = state.targets[target.siteId]
        const enabled = targetState?.enabled === true
        let activeSlot = target.kind === 'google' ? (targetState?.activeSlot ?? 1) : 1
        let accountSlots: number[] | undefined
        let googleDiscoveryUnverified = false
        if (target.kind === 'google') {
          const importKey = targetState?.slots?.[1]?.importedAt ?? targetState?.importedAt ?? ''
          const primary = this.deps.resolveSession(GOOGLE_AI_WEB_SESSION_PARTITION)
          const applyDiscoveredSlots = (discovered: number[]) => {
            accountSlots = googleAccountSlotOptions(discovered)
            if (!accountSlots.includes(activeSlot)) activeSlot = accountSlots[0] ?? 1
          }
          const peeked = peekGoogleAccountSlots(primary, importKey)
          if (!peeked.known) {
            // First look after start-up: the list may wait once so the first
            // open still shows the account selector. Later opens read the
            // snapshot and refresh it in the background.
            const discovered = await getGoogleAccountSlots(primary, importKey)
            if (discovered !== null) applyDiscoveredSlots(discovered)
            else googleDiscoveryUnverified = true
          } else {
            if (peeked.slots !== null) applyDiscoveredSlots(peeked.slots)
            else googleDiscoveryUnverified = true
            this.refreshGoogleAccountSlots(primary, importKey, peeked.slots)
          }
        }
        // A clamped slot must not borrow the old slot's top-level mirror. The
        // top-level fields describe the stored active slot; when discovery
        // moved us to another one and that slot has no history, the row says
        // "never imported" rather than attributing the old account's result.
        const slotWasClamped =
          target.kind === 'google' && activeSlot !== (targetState?.activeSlot ?? 1)
        const slotState = slotWasClamped ? targetState?.slots?.[activeSlot] : undefined
        const lastResult = slotWasClamped
          ? (slotState?.lastResult ?? null)
          : (targetState?.lastResult ?? null)
        const importedAt = slotWasClamped
          ? (slotState?.importedAt ?? null)
          : (targetState?.importedAt ?? null)
        const lastError = slotWasClamped
          ? (slotState?.lastError ?? null)
          : (targetState?.lastError ?? null)
        const hasLocalSession = await hasLocalSessionForTarget(
          {
            ...target,
            partition: partitionForTargetSlot(target.partition, activeSlot)
          },
          this.deps.resolveSession
        )
        let status = deriveSiteSessionStatus({
          enabled,
          extensionConnected,
          extensionVersionOk,
          lastResult,
          hasLocalSession
        })
        // A cookie on disk proves that an import wrote something, not that
        // Google still accepts it. When discovery cannot confirm the account
        // set, the honest status is "unverified" rather than "imported".
        if (
          target.kind === 'google' &&
          status === 'imported' &&
          (googleDiscoveryUnverified || (accountSlots?.length ?? 0) === 0)
        ) {
          status = 'session_unverified'
        }
        const view = toSiteSessionView(target, enabled, status, importedAt, lastError, activeSlot)
        if (accountSlots !== undefined) {
          view.accountSlots = accountSlots
        }
        return view
      })
    )

    return { views, extensionConnected, extensionVersionOk }
  }

  /**
   * Refreshes account discovery without making the list wait for Google.
   *
   * The list is served from the last snapshot immediately. When the refresh
   * moves the account set, the cached list is dropped and the renderer is
   * notified; an unchanged or failed refresh leaves the open page alone.
   */
  private refreshGoogleAccountSlots(
    primary: Session,
    importKey: string,
    previous: number[] | null
  ): void {
    void getGoogleAccountSlots(primary, importKey).then((discovered) => {
      if (discovered === null) return
      if (
        previous !== null &&
        previous.length === discovered.length &&
        previous.every((slot, index) => slot === discovered[index])
      ) {
        return
      }
      invalidateSiteSessionListCache()
      void broadcastSiteSessionsChanged()
    })
  }

  /**
   * Turns the import of one site on or off.
   *
   * Switching it on writes the switch and nothing else: no cookie is written
   * by the app, the extension pushes the session within its next round.
   *
   * Switching it off writes the switch first and wipes the session after it:
   * the site has to be signed in again the next time it is used. The wipe runs
   * under the lock of the site, so an import that is already running finishes
   * before the wipe and cannot undo it.
   */
  async setEnabled(siteId: string, enabled: boolean): Promise<SiteSessionActionResult> {
    // The switch changes what the list shows, so the list that is kept is
    // dropped before anything is written.
    invalidateSiteSessionListCache()

    const target = await this.findTarget(siteId)
    if (!target) return { success: false, error: 'unknown_target' }

    try {
      return await withSiteSessionLock(siteId, async () => {
        if (!enabled) return this.switchOff(target)
        try {
          await this.deps.config.setEnabled(siteId, true)
          return { success: true }
        } catch (error) {
          Logger.warn(`[SiteSession] The switch of "${siteId}" could not be written:`, error)
          return { success: false, error: 'write_failed' }
        }
      })
    } finally {
      invalidateSiteSessionListCache()
    }
  }

  /**
   * Forgets the session of one site without touching its switch.
   *
   * This is the "I sign in myself" path: the site keeps its place in the
   * settings, only the session the app holds for it is gone. The wipe runs
   * under the lock of the site, for the same reason the switch-off does.
   */
  async clear(siteId: string): Promise<SiteSessionActionResult> {
    // The session that is forgotten changes what the list shows, so the list
    // that is kept is dropped before the wipe starts.
    invalidateSiteSessionListCache()

    const target = await this.findTarget(siteId)
    if (!target) return { success: false, error: 'unknown_target' }

    try {
      return await withSiteSessionLock(siteId, async () => {
        try {
          await this.wipe(target)
        } catch (error) {
          Logger.warn(`[SiteSession] The session of "${siteId}" could not be cleared:`, error)
          return { success: false, error: 'wipe_failed' }
        }

        return { success: true }
      })
    } finally {
      invalidateSiteSessionListCache()
    }
  }

  /** The site with this id, or null when the app does not know it. */
  private async findTarget(siteId: string): Promise<SiteSessionTargetRow | null> {
    const targets = await this.deps.loadTargets()
    return targets.find((target) => target.siteId === siteId) ?? null
  }

  /**
   * Turns the switch of a site off and wipes the session it held.
   *
   * The order is the invariant: the switch is written first, so a packet that
   * arrives while the wipe is running is refused, and the wipe runs last, so
   * the site ends up without a session.
   */
  private async switchOff(target: SiteSessionTargetRow): Promise<SiteSessionActionResult> {
    try {
      await this.deps.config.setEnabled(target.siteId, false)
    } catch (error) {
      // The switch was not written. Reporting a success here would tell the
      // user that a site was switched off while the app keeps importing it.
      Logger.warn(`[SiteSession] The switch of "${target.siteId}" could not be written:`, error)
      return { success: false, error: 'write_failed' }
    }

    try {
      await this.wipe(target)
    } catch (error) {
      // The switch *was* written: the site is switched off, but the session
      // it held is still there. Saying "failed" alone would hide that
      // half of the work was done.
      Logger.warn(`[SiteSession] The session of "${target.siteId}" could not be cleared:`, error)
      return {
        success: false,
        error: 'switch_off_wipe_failed',
        detail: 'The switch was turned off, but the session could not be cleared.'
      }
    }

    return { success: true }
  }

  /** Switches the active profile slot (1 or 2) for a site. */
  async setActiveSlot(siteId: string, slot: number): Promise<SiteSessionActionResult> {
    if (!isSiteSessionSlot(slot)) return { success: false, error: 'invalid_slot' }
    const targets = await this.deps.loadTargets()
    const target = targets.find((candidate) => candidate.siteId === siteId)
    if (!target) {
      return { success: false, error: 'unknown_target' }
    }

    if (target.kind !== 'google' && slot !== 1) return { success: false, error: 'invalid_slot' }
    try {
      const config = this.deps.config
      if (!config.setActiveSlot) return { success: false, error: 'write_failed' }

      if (target.kind === 'google' && slot > 1) {
        // The renderer only offers discovered accounts, but a compromised or
        // stale renderer can send any number in 1..20. Validate the position
        // against the account list before touching the config or a partition.
        const state = await config.read()
        const importKey =
          state.targets[GOOGLE_AI_WEB_SITE_ID]?.slots?.[1]?.importedAt ??
          state.targets[GOOGLE_AI_WEB_SITE_ID]?.importedAt ??
          ''
        const discovered = await getGoogleAccountSlots(
          this.deps.resolveSession(GOOGLE_AI_WEB_SESSION_PARTITION),
          importKey
        )
        if (discovered === null) {
          return { success: false, error: 'account_discovery_unavailable' }
        }
        if (!googleAccountSlotOptions(discovered).includes(slot)) {
          return { success: false, error: 'invalid_slot' }
        }

        // Prepare the destination before the selection is written. A failed
        // import must leave the old account selected, not a half-seeded slot.
        const preparation = await ensureGoogleSessionSlot(slot, {
          config: {
            read: () => config.read(),
            recordResult: (...args) => config.recordResult!(...args),
            isEnabled: config.isEnabled
              ? (id) => config.isEnabled!(id)
              : async (id) => (await config.read()).targets[id]?.enabled === true
          },
          resolveSession: this.deps.resolveSession
        })
        if (!preparation.ok) {
          return {
            success: false,
            error: 'import_failed',
            detail:
              'The selected Google account could not be prepared; the previous account is still active.'
          }
        }
      }

      await withSiteSessionLock(siteId, () => config.setActiveSlot!(siteId, slot))
      invalidateSiteSessionListCache()
      await broadcastSiteSessionsChanged()
      return { success: true }
    } catch {
      return { success: false, error: 'write_failed' }
    }
  }

  /** Removes the session the app holds for one site across all slots. */
  private async wipe(target: SiteSessionTargetRow): Promise<void> {
    const state = await this.deps.config.read()
    // Include legacy secondary non-Google sessions when clearing, without selecting them.
    const slots = new Set([
      1,
      2,
      state.targets[target.siteId]?.activeSlot ?? 1,
      ...Object.keys(state.targets[target.siteId]?.slots ?? {}).map(Number)
    ])
    if (target.kind === 'google') {
      const existing = await Promise.all(
        SITE_SESSION_SLOTS.map(async (slot) => ({
          slot,
          exists: await partitionExistsOnDisk(partitionForTargetSlot(target.partition, slot))
        }))
      )
      for (const { slot, exists } of existing) if (exists) slots.add(slot)
    }
    let failed = false
    for (const slot of slots) {
      if (!isSiteSessionSlot(slot)) continue
      try {
        await wipeSiteSession(
          this.deps.resolveSession(partitionForTargetSlot(target.partition, slot)),
          target
        )
      } catch (error) {
        failed = true
        Logger.warn(`[SiteSession] Slot ${slot} of "${target.siteId}" could not be cleared:`, error)
      }
    }
    if (failed) throw new Error('One or more session slots could not be cleared')
    await this.deps.config.resetResults(target.siteId)
  }
}

/**
 * Whether the Chrome extension is talking to the app.
 *
 * The extension connects over the bridge; while it does not, the app cannot
 * pull a session from it.
 */
function isExtensionConnected(): boolean {
  return nativeMessagingManager.getExtensionInfo().status === 'connected'
}

/**
 * Whether the extension speaks the protocol of this build.
 *
 * The extension names the protocol it speaks in every request it makes to the
 * bridge, and the manager remembers the last one it reported. An extension
 * that reports nothing is an extension the user has to reload: it may be an
 * old copy that predates the handshake, and it would sit there connected
 * without ever pushing a session.
 */
export function isExtensionVersionOk(): boolean {
  const reported = nativeMessagingManager.getExtensionProtocolVersion()
  return reported !== null && reported >= SITE_SESSION_PROTOCOL_VERSION
}

/** The service the app uses. */
export const siteSessionService = new SiteSessionService({
  config: getSiteSessionConfig(),
  loadTargets: buildSiteSessionTargets,
  resolveSession: (partition) => electronSession.fromPartition(partition),
  isExtensionConnected,
  isExtensionVersionOk
})
