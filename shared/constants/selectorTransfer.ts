/**
 * The wire contract of the Chrome magic selector transfer.
 *
 * One source of truth for the paths, the field names, the request-id shape and
 * the size bounds. The Chrome extension is plain JavaScript without a build
 * step, so its copy of these values lives in `background.js`; the extension
 * bridge contract test re-reads them from this module and fails when the two
 * drift apart.
 *
 * The transfer is deliberately separate from the cookie packets: it has its own
 * path, its own signature payload and its own body limit, so it can work while
 * the site session sync is switched off and it can never touch the cookie
 * queue.
 */
import type { AutomationElementFingerprint } from '../types/automation.js'

/** The endpoint a picked element is posted to. */
export const SELECTOR_TRANSFER_PATH = '/api/selectors'

/** The endpoint that names the sites (and their fields) a pick may target. */
export const SELECTOR_SITES_PATH = '/api/selectors/sites'

/**
 * The payload version.
 *
 * Independent of the site session protocol: the app reports the feature through
 * the health `capabilities` field, so an older app and a newer extension keep
 * exchanging cookies even when the selector feature is unavailable.
 */
export const SELECTOR_TRANSFER_VERSION = 1

/** The largest selector payload the bridge accepts. */
export const MAX_SELECTOR_BODY_SIZE = 16 * 1024

/**
 * The most bytes the bridge ever reads from a selector POST.
 *
 * The extra room lets a body that is only a little too large be read to its
 * end, so its signature can still be checked and the answer can be a clean 413
 * instead of a broken connection.
 */
export const MAX_SELECTOR_READ_SIZE = MAX_SELECTOR_BODY_SIZE + 4 * 1024

/** The header that carries the idempotency key of one pick. */
export const SELECTOR_REQUEST_ID_HEADER = 'x-quizlab-request-id'

/** How long a request id is remembered for replay detection. */
export const SELECTOR_REQUEST_TTL_MS = 10 * 60 * 1000

/** How many request ids are remembered at most, per bridge. */
export const MAX_SELECTOR_REQUEST_IDS = 500

/** The locator fields a pick can target: the existing selector schema only knows these two. */
export type SelectorField = 'input' | 'button'

/** Whether a value is a targetable locator field. */
export function isSelectorField(value: unknown): value is SelectorField {
  return value === 'input' || value === 'button'
}

/** A request id is a bounded token; it is signed together with the body. */
const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{16,64}$/

/** Whether a value can be used as an idempotency key. */
export function isSelectorRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_REGEX.test(value)
}

/** The payload one picked element travels in. */
export interface SelectorTransferPayload {
  version: typeof SELECTOR_TRANSFER_VERSION
  /** Idempotency key of this pick; also the header value. */
  requestId: string
  /** The hostname of the page the element was picked on. */
  hostname: string
  /** Which stored locator the pick describes. */
  field: SelectorField
  /** The verified primary CSS selector. */
  selector: string
  /** The candidate selectors, primary included, in priority order. */
  candidates: string[]
  /** Structural identity of the picked element. */
  fingerprint: AutomationElementFingerprint
  /** The full address of the page the element was picked on. */
  sourceUrl: string
}

/** The selector status of one site, as the settings store knows it. */
export interface SelectorSiteStatus {
  input: 'ready' | 'migrated' | 'repaired' | 'needs_repick' | 'missing'
  button: 'ready' | 'migrated' | 'repaired' | 'needs_repick' | 'missing'
}

/** One site a pick may target. */
export interface SelectorSiteEntry {
  /** Stable app id of the site (the platform id). */
  siteId: string
  /** Human readable name, shown by the extension popup. */
  displayName: string
  /** The host the site's own entry URL lives on. */
  hostname: string
  /** Every host (host suffix included) that belongs to this site. */
  hosts: string[]
  /** The locator fields the picker may fill for this site. */
  fields: SelectorField[]
  /** The stored status of the locators, when the site has a config. */
  status?: SelectorSiteStatus
}

/** The answer of the sites endpoint. */
export interface SelectorSitesResponse {
  version: typeof SELECTOR_TRANSFER_VERSION
  sites: SelectorSiteEntry[]
}

/**
 * What the extension signs when it asks for the selector sites.
 *
 * The profile id is part of the payload, so a captured request cannot be
 * relabelled as another Chrome profile without the pairing secret.
 */
export function selectorSitesSigningPayload(profileId: string): string {
  return `${profileId}\n${SELECTOR_SITES_PATH}`
}

/**
 * What the extension signs when it sends a picked element.
 *
 * The path, the request id and the whole body are covered: a captured request
 * cannot be replayed as another pick, and the idempotency key cannot be
 * swapped for a different one.
 */
export function selectorTransferSigningPayload(
  profileId: string,
  requestId: string,
  body: string
): string {
  return `${profileId}\n${SELECTOR_TRANSFER_PATH}\n${requestId}\n${body}`
}
