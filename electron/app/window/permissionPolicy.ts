/**
 * Central Web Permission policy.
 *
 * Every `setPermissionRequestHandler` / `setPermissionCheckHandler` in the app
 * routes through {@link evaluateWebPermission}. Keeping the decision in one
 * pure function is what makes the policy auditable: the request and check
 * paths cannot drift apart, and every branch is unit-testable without
 * booting Electron.
 *
 * Threat model
 * ------------
 * AI providers are rendered inside `<webview>` guests, each with its own
 * persistent session partition. A session-level grant is NOT scoped to an
 * origin: once `setPermissionRequestHandler` answers `true`, *every* document
 * loaded in that partition inherits the grant. So a provider page that
 * navigates to (or is redirected to) an attacker-controlled page hands that
 * page the provider's ambient capabilities.
 *
 * The policy therefore never grants on partition alone. A request must match
 * BOTH:
 *   1. a partition this app created for a known provider, and
 *   2. an origin registered for that specific partition.
 *
 * Anything else is denied. Custom (user-added) platforms get their own origin
 * registered so passive capabilities keep working, but ambient sensing
 * (camera/mic/location) stays denied for them by default.
 *
 * This module must stay free of `electron` imports so it can be unit-tested
 * directly; main-process-only concerns (dialogs, BrowserWindow lookup) live
 * in the caller.
 */
import {
  GOOGLE_AI_WEB_SESSION_PARTITION,
  GOOGLE_WEB_SESSION_APPS
} from '../../../shared/constants/googleAiWebApps.js'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../../features/ai/aiManager.js'

/** Partition key used for `session.defaultSession` (the app's own UI). */
export const APP_SESSION_PARTITION = 'app'

/** Partitions minted for user-added platforms, see aiRegistryHandlers. */
export const CUSTOM_PARTITION_PREFIX = 'persist:ai_custom_'

/** Fallback partition for non-site custom/API models. Hosts no fixed origin. */
export const GENERIC_AI_PARTITION = 'persist:ai_session'

export type PermissionDenialReason =
  | 'not_a_known_partition'
  | 'malformed_origin'
  | 'origin_not_registered'
  | 'permission_not_allowlisted'
  | 'ambient_not_supported_by_provider'
  | 'subframe_denied'
  | 'consent_required'
  | 'consent_denied'

export type WebPermissionDecision = {
  granted: boolean
  reason: PermissionDenialReason | 'allowed_passive' | 'allowed_ambient' | 'allowed_app_session'
  /** Eligible on policy grounds, but still needs a one-time user decision. */
  requiresConsent: boolean
}

export type WebPermissionRequest = {
  partition: string
  permission: string
  /** Origin reported by Chromium for the requesting frame. */
  requestingOrigin?: string
  /** Full URL reported by Chromium for the requesting frame. */
  requestingUrl?: string
  /** False for iframes/subframes. Ambient grants are main-frame only. */
  isMainFrame?: boolean
}

export const isCustomPartition = (partition: string): boolean =>
  partition.startsWith(CUSTOM_PARTITION_PREFIX)

/**
 * Capabilities that expose nothing about the user or their machine: they
 * cannot read data and cannot capture the environment. Allowed on any
 * registered origin without a prompt.
 */
const PASSIVE_PERMISSIONS: ReadonlySet<string> = new Set([
  'notifications',
  'fullscreen',
  'pointerLock',
  'clipboard-sanitized-write'
])

/**
 * Ambient-sensing capabilities. Every one of these is consent-gated and must
 * also appear in the partition's allowlist below.
 */
const AMBIENT_PERMISSIONS: ReadonlySet<string> = new Set([
  'media',
  'geolocation',
  'display-capture'
])

/**
 * Which ambient permissions a built-in provider may ask for.
 *
 * This is deliberately an explicit per-partition list rather than "all
 * providers get everything": the combination of partition and permission is
 * the unit of authorization, and adding a provider must be a conscious act.
 *
 * - `media` is limited to providers with a voice mode (Gemini Live, ChatGPT
 *   voice, Claude voice, Copilot/M365 voice).
 * - `display-capture` covers the "share a screen/window into the chat"
 *   flow. It is additionally gated by the native source picker in
 *   sessions.ts, which is the real consent step and also bounds what is
 *   captured, so it is not double-prompted.
 * - `geolocation` appears in NO entry on purpose. No shipped provider needs
 *   it, so it is denied for every origin rather than merely un-prompted.
 *   Adding it later is a one-line, reviewable change.
 */
const PARTITION_AMBIENT_ALLOWLIST: Readonly<Record<string, ReadonlySet<string>>> = {
  'persist:ai_chatgpt': new Set(['media', 'display-capture']),
  'persist:ai_claude': new Set(['media', 'display-capture']),
  'persist:ai_m365': new Set(['media', 'display-capture']),
  'persist:ai_copilot': new Set(['media', 'display-capture']),
  [GOOGLE_AI_WEB_SESSION_PARTITION]: new Set(['media', 'display-capture'])
}

/** Extracts a comparable hostname, or null if the URL is not a usable https origin. */
function hostnameOf(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  const host = parsed.hostname.toLowerCase()
  return host.length > 0 ? host : null
}

/** Exact host, or a subdomain of it. Never a sibling/parent domain. */
function hostMatches(host: string, trustedHost: string): boolean {
  return host === trustedHost || host.endsWith(`.${trustedHost}`)
}

/**
 * partition -> trusted hostnames, derived from the AI registry so a new
 * provider cannot be silently blocked (or silently trusted) by a stale
 * hand-maintained list.
 */
const builtinTrustedHosts = new Map<string, Set<string>>()

const registerBuiltin = (partition: string | undefined, url: string | undefined): void => {
  if (!partition || !url) return
  const host = hostnameOf(url)
  if (!host) return
  const existing = builtinTrustedHosts.get(partition)
  if (existing) existing.add(host)
  else builtinTrustedHosts.set(partition, new Set([host]))
}

for (const platform of Object.values(AI_REGISTRY)) {
  registerBuiltin(platform.partition, platform.url)
}
for (const platform of Object.values(INACTIVE_PLATFORMS)) {
  registerBuiltin(platform.partition, platform.url)
}
for (const googleApp of GOOGLE_WEB_SESSION_APPS) {
  registerBuiltin(GOOGLE_AI_WEB_SESSION_PARTITION, `https://${googleApp.hostname}`)
}

/** Origins for user-added platforms, keyed by their custom partition. */
const customTrustedHosts = new Map<string, Set<string>>()

/**
 * Records the origin a user explicitly chose for a custom platform.
 *
 * Registering the origin is what lets a custom platform keep working
 * normally; it deliberately does not add the partition to
 * PARTITION_AMBIENT_ALLOWLIST, so custom sites stay default-deny for
 * camera/mic/location.
 */
export function registerCustomPlatformOrigin(partition: string, url: string): void {
  if (!isCustomPartition(partition)) return
  const host = hostnameOf(url)
  if (!host) return
  const existing = customTrustedHosts.get(partition)
  if (existing) existing.add(host)
  else customTrustedHosts.set(partition, new Set([host]))
}

/** Drops a custom platform's origin binding when the platform is removed. */
export function unregisterCustomPlatformOrigin(partition: string): void {
  customTrustedHosts.delete(partition)
}

/**
 * Partitions a `<webview>` may attach to. Derived from the registry, so this
 * stays in sync with AI_REGISTRY / INACTIVE_PLATFORMS / the Google session
 * partition instead of drifting from a hard-coded copy.
 */
export function isAllowedWebviewPartition(partition: unknown): boolean {
  if (typeof partition !== 'string' || partition.length === 0) return false
  if (partition === GENERIC_AI_PARTITION) return true
  if (builtinTrustedHosts.has(partition)) return true
  return isCustomPartition(partition)
}

/**
 * Every partition that needs a session permission handler configured.
 *
 * Single source of truth: sessions.ts used to recompute this union from
 * AI_REGISTRY + INACTIVE_PLATFORMS + APP_CONFIG.PARTITIONS.AI, which could
 * drift from the trusted-host table above and leave a partition without a
 * policy (or configure one twice).
 */
export function listManagedAiPartitions(): string[] {
  return [GENERIC_AI_PARTITION, ...builtinTrustedHosts.keys()]
}

function trustedHostsFor(partition: string): ReadonlySet<string> | null {
  if (partition === GENERIC_AI_PARTITION) {
    // Hosts arbitrary provider UIs chosen at runtime, so it has no fixed
    // origin to bind to. Treated as untrusted for every permission.
    return null
  }
  return builtinTrustedHosts.get(partition) ?? customTrustedHosts.get(partition) ?? null
}

/**
 * The app's own UI document. In production it is served from `file:`; in dev
 * from a loopback origin. Anything else reaching the default session (a
 * webview that failed to get its own partition, a popup) is untrusted.
 */
function isAppDocumentUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol === 'file:') return true
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
}

/** Session-lifetime consent decisions, keyed by partition + origin + permission. */
const consentGrants = new Set<string>()
const consentDenials = new Set<string>()

const consentKey = (partition: string, host: string, permission: string): string =>
  `${partition} ${host} ${permission}`

export type ConsentState = 'granted' | 'denied' | 'undecided'

export function getConsentState(partition: string, host: string, permission: string): ConsentState {
  const key = consentKey(partition, host, permission)
  if (consentGrants.has(key)) return 'granted'
  if (consentDenials.has(key)) return 'denied'
  return 'undecided'
}

/** Records the user's answer so the prompt is shown at most once per app run. */
export function recordConsentDecision(
  partition: string,
  host: string,
  permission: string,
  granted: boolean
): void {
  const key = consentKey(partition, host, permission)
  if (granted) {
    consentGrants.add(key)
    consentDenials.delete(key)
  } else {
    consentDenials.add(key)
    consentGrants.delete(key)
  }
}

/** Test seam: drops all remembered consent decisions. */
export function resetConsentDecisions(): void {
  consentGrants.clear()
  consentDenials.clear()
}

/** Test seam: drops registered custom origins. */
export function resetCustomPlatformOrigins(): void {
  customTrustedHosts.clear()
}

const deny = (reason: PermissionDenialReason): WebPermissionDecision => ({
  granted: false,
  reason,
  requiresConsent: false
})

/**
 * The single decision point for every web permission in the app.
 *
 * Both `setPermissionRequestHandler` and `setPermissionCheckHandler` call
 * this, because Chromium consults the check handler before some Web APIs
 * (notably Geolocation) and a policy that only answers requests would leave
 * those paths unguarded.
 */
export function evaluateWebPermission(request: WebPermissionRequest): WebPermissionDecision {
  const { partition, permission } = request
  const isMainFrame = request.isMainFrame !== false

  if (partition === APP_SESSION_PARTITION) {
    if (!isAppDocumentUrl(request.requestingUrl ?? request.requestingOrigin)) {
      return deny('origin_not_registered')
    }
    if (PASSIVE_PERMISSIONS.has(permission) || permission === 'media') {
      return { granted: true, reason: 'allowed_app_session', requiresConsent: false }
    }
    return deny('permission_not_allowlisted')
  }

  const trustedHosts = trustedHostsFor(partition)
  if (!trustedHosts) return deny('not_a_known_partition')

  // Ambient capabilities stay main-frame only: an iframe on a trusted origin
  // is still third-party code and must not inherit the provider's grant.
  if (AMBIENT_PERMISSIONS.has(permission) && !isMainFrame) {
    return deny('subframe_denied')
  }

  const host = hostnameOf(request.requestingUrl) ?? hostnameOf(request.requestingOrigin)
  if (!host) return deny('malformed_origin')

  let originTrusted = false
  for (const trusted of trustedHosts) {
    if (hostMatches(host, trusted)) {
      originTrusted = true
      break
    }
  }
  if (!originTrusted) return deny('origin_not_registered')

  if (PASSIVE_PERMISSIONS.has(permission)) {
    return { granted: true, reason: 'allowed_passive', requiresConsent: false }
  }

  if (!AMBIENT_PERMISSIONS.has(permission)) {
    return deny('permission_not_allowlisted')
  }

  const allowedForProvider = PARTITION_AMBIENT_ALLOWLIST[partition]
  if (!allowedForProvider || !allowedForProvider.has(permission)) {
    return deny('ambient_not_supported_by_provider')
  }

  // display-capture consent is the native source picker in sessions.ts, which
  // both records the decision and bounds the capture to one chosen source.
  if (permission === 'display-capture') {
    return { granted: true, reason: 'allowed_ambient', requiresConsent: false }
  }

  const state = getConsentState(partition, host, permission)
  if (state === 'granted') {
    return { granted: true, reason: 'allowed_ambient', requiresConsent: false }
  }
  if (state === 'denied') {
    return deny('consent_denied')
  }
  return { granted: false, reason: 'consent_required', requiresConsent: true }
}

/** Human-readable capability name for the consent dialog. */
export function describePermission(permission: string): string {
  switch (permission) {
    case 'media':
      return 'camera and microphone'
    case 'geolocation':
      return 'your location'
    case 'display-capture':
      return 'screen sharing'
    case 'notifications':
      return 'notifications'
    default:
      return permission
  }
}
