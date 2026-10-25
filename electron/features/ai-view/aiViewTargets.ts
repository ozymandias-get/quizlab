import type { AiPlatform } from '@shared-core/types'

import {
  GOOGLE_AI_WEB_SESSION_PARTITION,
  GOOGLE_AI_WEB_SITE_ID,
  GOOGLE_WEB_SESSION_APPS
} from '../../../shared/constants/googleAiWebApps.js'
import { googleSessionUrl, googleSlotForPartition } from '../../../shared/lib/googleSessionUrl.js'
import type { AiViewSource } from '../../../shared/types/aiView.js'
import {
  isAllowedManagedViewPartition,
  isHostTrustedForPartition
} from '../../app/window/permissionPolicy.js'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../ai/aiManager.js'
import { readCustomPlatforms } from '../ai/customPlatformStore.js'
import { ensureGoogleSessionSlot } from '../web-session/googleSessionSlot.js'
import { getSiteSessionConfig } from '../web-session/siteSessionConfig.js'
import { partitionForTargetSlot } from '../web-session/siteSessionTargets.js'

/**
 * Where a managed remote view is allowed to come from.
 *
 * The renderer sends an `AiViewSource` key; the partition, entry URL and label
 * are resolved here from main-process state. That inversion is what keeps a
 * compromised renderer from asking for an arbitrary partition or origin.
 */
export interface AiViewTarget {
  partition: string
  url: string
  label: string
}

function entryOf(modelId: string): AiPlatform | undefined {
  const builtin = Object.prototype.hasOwnProperty.call(AI_REGISTRY, modelId)
    ? AI_REGISTRY[modelId]
    : undefined
  if (builtin) return builtin
  return Object.prototype.hasOwnProperty.call(INACTIVE_PLATFORMS, modelId)
    ? INACTIVE_PLATFORMS[modelId]
    : undefined
}

function toTarget(
  platform: AiPlatform | undefined,
  partition: string | undefined
): AiViewTarget | null {
  if (!platform) return null
  const url = typeof platform.url === 'string' ? platform.url : ''
  if (!url || !isAllowedManagedViewPartition(partition)) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null

  return {
    partition: partition as string,
    url: parsed.toString(),
    label: platform.displayName || platform.name || platform.id
  }
}

async function activeSlotForSite(siteId: string): Promise<number> {
  try {
    const state = await getSiteSessionConfig().read()
    return state.targets[siteId]?.activeSlot || 1
  } catch {
    return 1
  }
}

async function resolvePlatformTarget(
  modelId: string,
  sessionSlot?: number
): Promise<AiViewTarget | null> {
  const platform = entryOf(modelId)
  if (platform) {
    const siteId = GOOGLE_WEB_SESSION_APPS.some((app) => app.id === modelId)
      ? GOOGLE_AI_WEB_SITE_ID
      : modelId
    const slot =
      siteId === GOOGLE_AI_WEB_SITE_ID ? (sessionSlot ?? (await activeSlotForSite(siteId))) : 1
    const basePartition = platform.partition
    const partition = basePartition ? partitionForTargetSlot(basePartition, slot) : undefined
    const target = toTarget(platform, partition)
    if (target && siteId === GOOGLE_AI_WEB_SITE_ID) {
      await ensureGoogleSessionSlot(slot)
      target.url = googleSessionUrl(target.url, slot)
    }
    return target
  }

  const customPlatforms = await readCustomPlatforms()
  if (!Object.prototype.hasOwnProperty.call(customPlatforms, modelId)) return null
  const customPlatform = customPlatforms[modelId]
  const slot = 1
  const basePartition = customPlatform.partition
  const partition = basePartition ? partitionForTargetSlot(basePartition, slot) : undefined
  return toTarget(customPlatform, partition)
}

async function resolveGoogleAppTarget(
  appId: string,
  sessionSlot?: number
): Promise<AiViewTarget | null> {
  const app = GOOGLE_WEB_SESSION_APPS.find((candidate) => candidate.id === appId)
  if (!app) return null
  let parsed: URL
  try {
    parsed = new URL(app.url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  const slot = sessionSlot ?? (await activeSlotForSite(GOOGLE_AI_WEB_SITE_ID))
  const partition = partitionForTargetSlot(GOOGLE_AI_WEB_SESSION_PARTITION, slot)
  await ensureGoogleSessionSlot(slot)
  return { partition, url: googleSessionUrl(parsed.toString(), slot), label: app.name }
}

export async function resolveAiViewTarget(source: AiViewSource): Promise<AiViewTarget | null> {
  if (source.kind === 'google-web-app')
    return resolveGoogleAppTarget(source.appId, source.sessionSlot)
  return resolvePlatformTarget(source.modelId, source.sessionSlot)
}

/**
 * A restored URL is only honoured when it stays inside the origins already
 * trusted for the partition it will be loaded into. Anything else falls back to
 * the registry entry URL, so a tampered renderer cache cannot walk a managed
 * view onto a foreign origin.
 */
export function resolveEntryUrl(target: AiViewTarget, restoredUrl: string | null): string {
  if (!isUrlTrustedForTarget(target, restoredUrl)) return target.url
  // Safe by construction: the trust check above already parsed this exact string.
  const url = new URL(restoredUrl as string).toString()
  const googleSlot = googleSlotForPartition(target.partition)
  return googleSlot === null ? url : googleSessionUrl(url, googleSlot)
}

/**
 * Whether `rawUrl` may be loaded into a view bound to `target`.
 *
 * This is the single trust check behind both entry URL resolution and any later
 * renderer-initiated navigation, so it answers one question: is this an https URL
 * on an origin registered for the partition the view actually runs in?
 *
 * Host matching deliberately allows subdomains (`auth.chatgpt.com` for a
 * `chatgpt.com` target) instead of requiring an exact host, because provider
 * sign-in and consent flows legitimately move onto sibling subdomains — pinning
 * the exact entry host would break logging in while still not being the security
 * boundary. The boundary is the partition's origin registry, which the renderer
 * cannot extend: only main-process registry state (built-in providers, Google web
 * apps and explicitly registered custom platforms) contributes to it.
 */
export function isUrlTrustedForTarget(target: AiViewTarget, rawUrl: string | null): boolean {
  if (!rawUrl) return false
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  return isHostTrustedForPartition(target.partition, parsed.hostname)
}
