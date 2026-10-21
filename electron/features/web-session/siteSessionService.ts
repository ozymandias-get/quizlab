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

import type {
  SiteSessionActionResult,
  SiteSessionListResult
} from '../../../shared/types/siteSession.js'
import { PRIMARY_ACCOUNT_ID } from '../../../shared/types/siteSession.js'
import { Logger } from '../../core/logger.js'
import { nativeMessagingManager } from '../native-messaging/nativeMessagingManager.js'
import { hasLocalSessionForTarget, SITE_SESSION_PROTOCOL_VERSION } from './siteSessionBridge.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import {
  invalidateSiteSessionListCache,
  readCachedSiteSessionList,
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
  config: Pick<SiteSessionConfig, 'read' | 'setEnabled'>
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

    const list = await this.buildList()
    writeCachedSiteSessionList(list)
    return list
  }

  /** The list of the sites, read from the state and from the sessions. */
  private async buildList(): Promise<SiteSessionListResult> {
    const [targets, state] = await Promise.all([this.deps.loadTargets(), this.deps.config.read()])
    const extensionConnected = this.deps.isExtensionConnected()
    const extensionVersionOk = this.deps.isExtensionVersionOk()

    const views = await Promise.all(
      targets.map(async (target) => {
        const targetState = state.sites[target.siteId]?.accounts[PRIMARY_ACCOUNT_ID]
        const enabled = targetState?.enabled === true
        const hasLocalSession = await hasLocalSessionForTarget(target, this.deps.resolveSession)
        const status = deriveSiteSessionStatus({
          enabled,
          extensionConnected,
          extensionVersionOk,
          lastResult: targetState?.lastResult ?? null,
          hasLocalSession
        })
        return toSiteSessionView(
          target,
          enabled,
          status,
          targetState?.importedAt ?? null,
          targetState?.lastError ?? null
        )
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

    if (enabled) {
      try {
        await this.deps.config.setEnabled(siteId, PRIMARY_ACCOUNT_ID, true)
      } catch (error) {
        // The switch was not written. Reporting a success here would tell the
        // user that a site was switched on while the app never heard of it.
        Logger.warn(`[SiteSession] The switch of "${siteId}" could not be written:`, error)
        return { success: false, error: 'write_failed' }
      }
      return { success: true }
    }

    return withSiteSessionLock(siteId, () => this.switchOff(target))
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

    return withSiteSessionLock(siteId, async () => {
      try {
        await this.wipe(target)
      } catch (error) {
        Logger.warn(`[SiteSession] The session of "${siteId}" could not be cleared:`, error)
        return { success: false, error: 'wipe_failed' }
      }

      return { success: true }
    })
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
      await this.deps.config.setEnabled(target.siteId, PRIMARY_ACCOUNT_ID, false)
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
    await wipeSiteSession(this.deps.resolveSession(target.partition), target)
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
