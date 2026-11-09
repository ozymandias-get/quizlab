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

import type { NativeMessagingProfileSelectionResult } from '../../../shared/types/native-messaging.js'
import type {
  SiteSessionActionResult,
  SiteSessionListResult
} from '../../../shared/types/siteSession.js'
import { Logger } from '../../core/logger.js'
import { nativeMessagingManager } from '../native-messaging/nativeMessagingManager.js'
import { hasLocalSessionForTarget, SITE_SESSION_PROTOCOL_VERSION } from './siteSessionBridge.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import {
  invalidateSiteSessionListCache,
  readCachedSiteSessionList,
  siteSessionListGeneration,
  writeCachedSiteSessionList
} from './siteSessionListCache.js'
import { withSiteSessionLock } from './siteSessionLock.js'
import { deriveSiteSessionStatus } from './siteSessionStatus.js'
import {
  buildSiteSessionTargets,
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
    Partial<Pick<SiteSessionConfig, 'isEnabled' | 'recordResult'>>
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
    if (
      cached &&
      cached.extensionConnected === this.deps.isExtensionConnected() &&
      cached.extensionVersionOk === this.deps.isExtensionVersionOk()
    ) {
      return cached
    }

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
        const lastResult = targetState?.lastResult ?? null
        const importedAt = targetState?.importedAt ?? null
        const lastError = targetState?.lastError ?? null
        const hasLocalSession = await hasLocalSessionForTarget(target, this.deps.resolveSession)
        const status = deriveSiteSessionStatus({
          enabled,
          extensionConnected,
          extensionVersionOk,
          lastResult,
          hasLocalSession
        })
        return toSiteSessionView(target, enabled, status, importedAt, lastError)
      })
    )

    return { views, extensionConnected, extensionVersionOk }
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

  /**
   * Selects the Chrome profile the sessions are imported from.
   *
   * The manager persists the choice and rejects packets from the other
   * profiles. The cached list is dropped because the extension rows depend on
   * whether the selected profile is connected and paired.
   */
  async selectExtensionProfile(profileId: string): Promise<NativeMessagingProfileSelectionResult> {
    if (!nativeMessagingManager.hasProfile(profileId)) {
      return { success: false, error: 'unknown_profile' }
    }
    const previous = nativeMessagingManager.getSelectedProfileId()
    if (previous === profileId) return { success: true }

    // The cookies the app holds may belong to the previous Chrome profile.
    // The old source is wiped *before* the switch is persisted: if a wipe
    // fails, the old profile stays selected and can re-import, instead of the
    // app claiming a new source while the old account is still signed in.
    // The bridge refuses packets until this whole block finishes.
    nativeMessagingManager.beginSelectionChange()
    let result: NativeMessagingProfileSelectionResult
    try {
      const clear = await this.clearImportedSessionsAfterSourceChange()
      const clearedSiteIds = clear.clearedSiteIds
      if (clear.failedSiteIds.length > 0 || clear.readFailed) {
        // The old profile stays selected, so it can import the sites that were
        // cleared again. The result says exactly which ones those are instead
        // of pretending the whole change failed or succeeded.
        result = {
          success: false,
          error: 'wipe_failed',
          clearedSiteIds,
          failedSiteIds: clear.failedSiteIds,
          partial: clearedSiteIds.length > 0
        }
      } else {
        const selected = await nativeMessagingManager.selectProfile(profileId)
        result = selected
          ? { success: true }
          : {
              success: false,
              error: 'write_failed',
              ...(clearedSiteIds.length > 0
                ? { clearedSiteIds, failedSiteIds: [], partial: true }
                : {})
            }
      }
    } finally {
      nativeMessagingManager.endSelectionChange()
      invalidateSiteSessionListCache()
    }
    return result
  }

  /**
   * Forgets every enabled site's session after the cookie source changed.
   *
   * The wipe is not atomic: it touches one site at a time, and a site that
   * fails cannot undo the sites that were already cleared. The two lists are
   * returned separately so the caller can tell the user which sessions were
   * really forgotten and which still belong to the old profile.
   */
  private async clearImportedSessionsAfterSourceChange(): Promise<{
    clearedSiteIds: string[]
    failedSiteIds: string[]
    readFailed: boolean
  }> {
    const clearedSiteIds: string[] = []
    const failedSiteIds: string[] = []
    let readFailed = false
    try {
      const [targets, state] = await Promise.all([this.deps.loadTargets(), this.deps.config.read()])
      for (const target of targets) {
        if (state.targets[target.siteId]?.enabled !== true) continue
        try {
          await withSiteSessionLock(target.siteId, () => this.wipe(target))
          clearedSiteIds.push(target.siteId)
        } catch (error) {
          failedSiteIds.push(target.siteId)
          Logger.warn(
            `[SiteSession] The session of "${target.siteId}" could not be cleared after ` +
              `the Chrome profile changed:`,
            error
          )
        }
      }
    } catch (error) {
      Logger.warn('[SiteSession] The imported sessions could not be cleared:', error)
      // The target list itself could not be read: nothing is known to be
      // cleared, so the caller must not claim any site is safe.
      readFailed = true
    }
    return { clearedSiteIds, failedSiteIds, readFailed }
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

  /** Removes the session the app holds for one site. */
  private async wipe(target: SiteSessionTargetRow): Promise<void> {
    try {
      await wipeSiteSession(this.deps.resolveSession(target.partition), target)
    } catch (error) {
      Logger.warn(`[SiteSession] The session of "${target.siteId}" could not be cleared:`, error)
      throw error
    }
    await this.deps.config.resetResults(target.siteId)
  }
}

/**
 * Whether the Chrome extension is talking to the app and paired.
 *
 * An extension that reaches the bridge without the pairing code cannot read
 * the enabled site list, so it cannot import anything. The row has to say
 * "extension missing" until the user pairs it.
 */
function isExtensionConnected(): boolean {
  const info = nativeMessagingManager.getExtensionInfo()
  return info.status === 'connected' && info.paired
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
