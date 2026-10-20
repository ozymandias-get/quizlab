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
 * Two orderings matter and are the reason the service exists at all:
 *
 *   - Turning a site's switch off writes the switch *first* and wipes the
 *     session afterwards. A cookie packet that arrives in between is refused
 *     on the spot, and the session that is left behind goes after it.
 *   - A switch that could not be written is reported as a failure. The app
 *     must not tell the user that a site was switched off while it is still
 *     importing it.
 */

import type { Session } from 'electron'
import { session as electronSession } from 'electron'

import type { SiteSessionListResult } from '../../../shared/types/siteSession.js'
import { Logger } from '../../core/logger.js'
import { nativeMessagingManager } from '../native-messaging/nativeMessagingManager.js'
import { acceptSiteSessionPacket, hasLocalSessionForTarget } from './siteSessionBridge.js'
import { getSiteSessionConfig, type SiteSessionConfig } from './siteSessionConfig.js'
import type { CookiePacket, CookiePacketRejection } from './siteSessionCookieRouter.js'
import { deriveSiteSessionStatus } from './siteSessionStatus.js'
import {
  buildSiteSessionTargets,
  type SiteSessionTargetRow,
  toSiteSessionView
} from './siteSessionTargets.js'
import { wipeSiteSession } from './siteSessionWipe.js'

/** The outcome of an action on one site's session. */
export interface SiteSessionActionResult {
  success: boolean
  /**
   * A stable code the renderer can translate: `unknown_target` for a site the
   * app does not know, `write_failed` when the switch could not be written
   * and `wipe_failed` when the session could not be cleared.
   */
  error?: string
}

/**
 * The parts of the app the service works with.
 *
 * They are injected so that the service can be tested without touching the
 * user's real sessions, and so that the caller that owns the state decides
 * where it is read from.
 */
export interface SiteSessionServiceDeps {
  config: Pick<SiteSessionConfig, 'read' | 'setEnabled' | 'recordResult'>
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
   */
  async list(): Promise<SiteSessionListResult> {
    const [targets, state] = await Promise.all([this.deps.loadTargets(), this.deps.config.read()])
    const extensionConnected = this.deps.isExtensionConnected()
    const extensionVersionOk = this.deps.isExtensionVersionOk()

    const views = await Promise.all(
      targets.map(async (target) => {
        const targetState = state.targets[target.siteId]
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
   * the site has to be signed in again the next time it is used.
   */
  async setEnabled(siteId: string, enabled: boolean): Promise<SiteSessionActionResult> {
    const target = await this.findTarget(siteId)
    if (!target) return { success: false, error: 'unknown_target' }

    try {
      await this.deps.config.setEnabled(siteId, enabled)
    } catch (error) {
      // The switch was not written. Reporting a success here would tell the
      // user that a site was switched off while the app keeps importing it.
      Logger.warn(`[SiteSession] The switch of "${siteId}" could not be written:`, error)
      return { success: false, error: 'write_failed' }
    }

    if (!enabled) {
      try {
        await this.wipe(target)
      } catch (error) {
        Logger.warn(`[SiteSession] The session of "${siteId}" could not be cleared:`, error)
        return { success: false, error: 'wipe_failed' }
      }
    }

    return { success: true }
  }

  /**
   * Forgets the session of one site without touching its switch.
   *
   * This is the "I sign in myself" path: the site keeps its place in the
   * settings, only the session the app holds for it is gone.
   */
  async clear(siteId: string): Promise<SiteSessionActionResult> {
    const target = await this.findTarget(siteId)
    if (!target) return { success: false, error: 'unknown_target' }

    try {
      await this.wipe(target)
    } catch (error) {
      Logger.warn(`[SiteSession] The session of "${siteId}" could not be cleared:`, error)
      return { success: false, error: 'wipe_failed' }
    }

    return { success: true }
  }

  /**
   * Handles one packet of the extension.
   *
   * The packet is not interpreted here: the bridge core decides whether it
   * belongs to a site that is switched on and whether every cookie in it
   * belongs to that site. The service only hands over the state it works on,
   * so that the switch it wrote is the switch the packet is judged by.
   */
  async importPacket(
    packet: CookiePacket
  ): Promise<{ accepted: boolean; reason?: CookiePacketRejection }> {
    const outcome = await acceptSiteSessionPacket(packet, {
      config: this.deps.config,
      loadTargets: this.deps.loadTargets,
      resolveSession: this.deps.resolveSession
    })
    return { accepted: outcome.accepted, reason: outcome.reason }
  }

  /**
   * Releases what the service holds.
   *
   * The service keeps no listener and no timer of its own: the state it works
   * on belongs to the config and to the sessions. The method exists so that
   * the app can shut the feature down with a single call.
   */
  dispose(): void {
    // Nothing to release.
  }

  /** The site with this id, or null when the app does not know it. */
  private async findTarget(siteId: string): Promise<SiteSessionTargetRow | null> {
    const targets = await this.deps.loadTargets()
    return targets.find((target) => target.siteId === siteId) ?? null
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
 * The extension pulls the app's protocol version when it asks for the site
 * list and stays silent when it does not understand it, so an extension that
 * is too old never reaches the app: it is reported as missing rather than as
 * outdated. The extension that does talk to us therefore speaks the protocol.
 *
 * The extension does not report its own version yet — it only reads the one
 * of the app. The flag stays in the contract for the day it does.
 */
function isExtensionVersionOk(): boolean {
  return isExtensionConnected()
}

/** The service the app uses. */
export const siteSessionService = new SiteSessionService({
  config: getSiteSessionConfig(),
  loadTargets: buildSiteSessionTargets,
  resolveSession: (partition) => electronSession.fromPartition(partition),
  isExtensionConnected,
  isExtensionVersionOk
})
