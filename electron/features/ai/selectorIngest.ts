/**
 * Turns a Chrome pick into a stored locator — or refuses it.
 *
 * The order is deliberate and every step is a gate:
 *
 *   1. the payload is a bounded, well-shaped selector transfer;
 *   2. the host belongs to a site the app knows, and the field is one the
 *      selector schema supports;
 *   3. the site is open in a managed Electron view, so the selector can be
 *      checked against the DOM the automation will actually run on;
 *   4. the existing lookup pipeline resolves the selector to a unique element
 *      that agrees with the fingerprint, in the primary candidate;
 *   5. only then is the patch merged into the one config store.
 *
 * Nothing is written before step 5, so a failed verification leaves the
 * working selector untouched. The patch clears the staged self-healing state,
 * which is what keeps an old repair candidate from reclaiming the locator the
 * user just picked; `lastRepair` history is kept, exactly like the in-app pick.
 */
import type { AiSelectorConfig, AutomationElementFingerprint } from '@shared-core/types'

import {
  isSelectorField,
  isSelectorRequestId,
  SELECTOR_TRANSFER_VERSION,
  type SelectorField,
  type SelectorTransferPayload
} from '../../../shared/constants/selectorTransfer.js'
import { canonicalizeHostname } from '../../../shared/selectorConfig.js'
import { isPersistableSelector } from '../../../shared/selectorRepair/selectorValidation.js'
import { generateVerifyLocatorScript } from '../automation/automationScripts/generators/verifyLocator.js'
import { sanitizeFingerprint } from './aiConfigFingerprint.js'
import { normalizeHostname } from './aiConfigSanitize.js'
import { findSelectorSiteMatch, type SelectorSiteTarget } from './selectorTargets.js'

/** The largest fingerprint the transfer accepts; the sanitizer bounds it again. */
const MAX_FINGERPRINT_TAG_LENGTH = 32
const MAX_CANDIDATES = 12
const MAX_URL_LENGTH = 2048
const MAX_SITE_ID_LENGTH = 120

/** What a live managed view is, for the verification. */
export interface SelectorLiveView {
  viewId: string
  url: string
}

/** Everything the ingestion needs from the process, injectable for tests. */
export interface SelectorIngestDeps {
  loadSites: () => Promise<SelectorSiteTarget[]>
  /** Every stored config, keyed by hostname. */
  readConfigs: () => Promise<Record<string, AiSelectorConfig>>
  savePatch: (hostname: string, patch: AiSelectorConfig) => Promise<boolean>
  /** The managed view whose page belongs to this site, or null. */
  findViewForSite: (site: SelectorSiteTarget) => Promise<SelectorLiveView | null>
  executeScript: (viewId: string, script: string) => Promise<unknown>
  /** The view's address after the script ran, or null when it is gone. */
  getViewUrl: (viewId: string) => Promise<string | null>
  broadcastConfigChanged: (hostname: string) => void
  /**
   * Records why a pick was not accepted.
   *
   * Deliberately limited to identifiers needed to debug the decision. The raw
   * fingerprint can carry page text (button labels, placeholders) and the raw
   * verifier result carries the matched element's text, so neither is logged.
   */
  logVerificationFailure?: (details: SelectorPickFailure) => void
}

/** The bounded, non-content summary of a refused pick. */
export interface SelectorPickFailure {
  hostname: string
  field: SelectorField
  reason: string
  tag: string
  /** Which identity attributes the pick carried, never their values. */
  identity: {
    role: boolean
    type: boolean
    dataTestId: boolean
    id: boolean
    name: boolean
    ariaLabel: boolean
    placeholder: boolean
    text: boolean
    contentEditable: boolean
  }
  verifier: {
    matchedSelector: string | null
    strategy: string | null
    attempts: number
    ambiguous: boolean
  }
}

/** The result of one ingestion, mapped to HTTP by the bridge. */
export type SelectorIngestResult =
  | { status: 'saved'; hostname: string; field: SelectorField }
  | { status: 'invalid_payload'; reason: string }
  | { status: 'unknown_site' }
  | { status: 'ambiguous_site' }
  | { status: 'site_not_open' }
  | { status: 'verification_failed'; reason: string }
  | { status: 'save_failed' }

interface VerificationDescriptor {
  tag?: unknown
  role?: unknown
  type?: unknown
  id?: unknown
  dataTestId?: unknown
  ariaLabel?: unknown
  placeholder?: unknown
  name?: unknown
  contentEditable?: unknown
  classTokens?: unknown
  text?: unknown
}

interface VerificationResult {
  success?: unknown
  field?: unknown
  matchedSelector?: unknown
  strategy?: unknown
  descriptor?: VerificationDescriptor | null
  attempts?: unknown
  diagnostics?: Record<string, { ambiguous?: unknown } | undefined>
}

interface VerificationAttempt {
  selector?: unknown
  matchedSelector?: unknown
  strategy?: unknown
  elementKey?: unknown
  descriptor?: VerificationDescriptor | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeUrlHost(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    return parsed.hostname.toLowerCase() || null
  } catch {
    return null
  }
}

/**
 * Parses and bounds one transfer payload.
 *
 * Every string is length-bounded and every selector passes the same
 * persistability gate the sanitizer applies, so a payload that reaches the
 * verifier is already a candidate for storage.
 */
export function parseSelectorTransferPayload(
  raw: unknown
): { payload: SelectorTransferPayload } | { reason: string } {
  if (!isRecord(raw)) return { reason: 'not_an_object' }
  if (raw.version !== SELECTOR_TRANSFER_VERSION) return { reason: 'unsupported_version' }
  if (!isSelectorRequestId(raw.requestId)) return { reason: 'invalid_request_id' }
  if (!isSelectorField(raw.field)) return { reason: 'invalid_field' }

  const hostname = normalizeHostname(raw.hostname)
  if (!hostname) return { reason: 'invalid_hostname' }

  const rawSelector = raw.selector
  if (typeof rawSelector !== 'string' || !isPersistableSelector(rawSelector)) {
    return { reason: 'invalid_selector' }
  }
  const selector = rawSelector.trim()

  if (!Array.isArray(raw.candidates) || raw.candidates.length === 0) {
    return { reason: 'missing_candidates' }
  }
  if (raw.candidates.length > MAX_CANDIDATES) return { reason: 'too_many_candidates' }
  const candidates: string[] = []
  for (const candidate of raw.candidates) {
    if (!isPersistableSelector(candidate)) return { reason: 'invalid_candidate' }
    const normalized = candidate.trim()
    if (!candidates.includes(normalized)) candidates.push(normalized)
  }
  if (!candidates.includes(selector)) return { reason: 'primary_not_in_candidates' }

  const fingerprint = raw.fingerprint
  if (!isRecord(fingerprint)) return { reason: 'missing_fingerprint' }
  if (typeof fingerprint.tag !== 'string' || !fingerprint.tag.trim()) {
    return { reason: 'missing_fingerprint_tag' }
  }
  if (fingerprint.tag.length > MAX_FINGERPRINT_TAG_LENGTH) {
    return { reason: 'fingerprint_tag_too_long' }
  }
  // The same field-by-field sanitizer the config store applies: unknown keys are
  // dropped, values are length-bounded and a fingerprint that does not describe
  // an element at all is refused. Validating here means the verifier and the
  // stored fingerprint are the same object, not a cast of the wire value.
  const sanitizedFingerprint = sanitizeFingerprint(fingerprint)
  if (!sanitizedFingerprint) return { reason: 'invalid_fingerprint' }

  let siteId: string | undefined
  if (raw.siteId !== undefined) {
    if (
      typeof raw.siteId !== 'string' ||
      !raw.siteId.trim() ||
      raw.siteId.trim().length > MAX_SITE_ID_LENGTH
    ) {
      return { reason: 'invalid_site_id' }
    }
    siteId = raw.siteId.trim()
  }

  if (typeof raw.sourceUrl !== 'string' || raw.sourceUrl.length > MAX_URL_LENGTH) {
    return { reason: 'invalid_url' }
  }
  const sourceHost = normalizeUrlHost(raw.sourceUrl)
  if (!sourceHost) return { reason: 'invalid_url' }
  if (sourceHost !== hostname) return { reason: 'hostname_url_mismatch' }

  return {
    payload: {
      version: SELECTOR_TRANSFER_VERSION,
      requestId: raw.requestId,
      hostname,
      ...(siteId ? { siteId } : {}),
      field: raw.field,
      selector,
      candidates,
      fingerprint: sanitizedFingerprint,
      sourceUrl: raw.sourceUrl.trim()
    }
  }
}

function normalizeComparisonText(value: unknown): string {
  return typeof value === 'string' ? value.replaceAll(/\s+/g, ' ').trim().toLowerCase() : ''
}

function presentString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

type IdentityVerdict = 'match' | 'mismatch' | 'insufficient'

/**
 * Compares the element the Electron view resolved with the element Chrome
 * picked.
 *
 * Three outcomes, because "the attribute is missing" is not the same answer as
 * "the attribute says this is another element":
 *
 *   - `mismatch`: a *stable* identity attribute is present on both sides and
 *     differs, or the tag differs. The element is definitely not the pick.
 *   - `insufficient`: nothing contradicts the pick, but no positive identity
 *     evidence survived either (only the tag agrees, or every attribute the
 *     fingerprint carries is missing from the app's DOM). Storing a wrong twin
 *     on tag alone is exactly the failure this gate exists to stop.
 *   - `match`: at least one non-class identity field agrees and nothing stable
 *     contradicts it.
 *
 * Localisable text (`text`, `aria-label`, `placeholder`) only ever *adds*
 * evidence. A site rendered in another language does not reject a pick whose
 * stable identity agrees; it simply stops being evidence when a strong
 * attribute is absent.
 */
function compareDescriptorToFingerprint(
  descriptor: VerificationDescriptor | null | undefined,
  fingerprint: AutomationElementFingerprint
): IdentityVerdict {
  if (!isRecord(descriptor)) return 'insufficient'
  const actualTag = presentString(descriptor.tag)
  const expectedTag = presentString(fingerprint.tag)
  if (!actualTag || !expectedTag) return 'insufficient'
  if (actualTag.toLowerCase() !== expectedTag.toLowerCase()) return 'mismatch'

  let evidence = 0

  const stable: Array<{
    actual: unknown
    expected: string | null | undefined
    ignoreCase?: boolean
  }> = [
    { actual: descriptor.role, expected: fingerprint.role, ignoreCase: true },
    { actual: descriptor.type, expected: fingerprint.type, ignoreCase: true },
    { actual: descriptor.dataTestId, expected: fingerprint.dataTestId },
    { actual: descriptor.id, expected: fingerprint.safeId },
    { actual: descriptor.name, expected: fingerprint.name }
  ]
  for (const field of stable) {
    const expected = presentString(field.expected)
    if (!expected) continue
    const actual = presentString(field.actual)
    // Missing on the app's side is missing evidence, not a contradiction.
    if (!actual) continue
    const same = field.ignoreCase
      ? actual.toLowerCase() === expected.toLowerCase()
      : actual === expected
    if (!same) return 'mismatch'
    evidence += 2
  }

  if (fingerprint.contentEditable === true) {
    if (descriptor.contentEditable !== true) return 'mismatch'
    evidence += 2
  }

  const semantic: Array<{ actual: unknown; expected: string | null | undefined }> = [
    { actual: descriptor.ariaLabel, expected: fingerprint.ariaLabel },
    { actual: descriptor.placeholder, expected: fingerprint.placeholder },
    { actual: descriptor.text, expected: fingerprint.text }
  ]
  for (const field of semantic) {
    const expected = normalizeComparisonText(field.expected)
    if (!expected) continue
    const actual = normalizeComparisonText(field.actual)
    if (!actual) continue
    if (actual === expected) evidence += 1
  }

  // Class tokens are shared by twins (ChatGPT's send and voice buttons agree on
  // the composer classes), so they can support a pick but never identify one.
  if (Array.isArray(descriptor.classTokens) && Array.isArray(fingerprint.classTokens)) {
    const actualTokens = new Set(
      descriptor.classTokens.filter((token): token is string => typeof token === 'string')
    )
    if (fingerprint.classTokens.some((token) => actualTokens.has(token))) evidence += 1
  }

  return evidence > 0 ? 'match' : 'insufficient'
}

/**
 * The candidates the verifier resolved, newest shape first.
 *
 * A verifier that ran before `attempts` existed reported one resolved element.
 * Both shapes carry the same three fields per candidate, so the decision below
 * does not need two code paths.
 */
function verificationAttempts(result: VerificationResult): VerificationAttempt[] {
  if (Array.isArray(result.attempts)) {
    return result.attempts.filter((attempt): attempt is VerificationAttempt => isRecord(attempt))
  }
  if (result.success === true && typeof result.matchedSelector === 'string') {
    return [
      {
        matchedSelector: result.matchedSelector,
        strategy: result.strategy,
        descriptor: result.descriptor
      }
    ]
  }
  return []
}

/**
 * Runs the generated verifier and decides whether the pick is trustworthy.
 *
 * Every candidate the verifier resolved is considered, in the order the pick
 * submitted them. The runtime orders candidates by its own priority, so the
 * first resolved candidate can be a twin of the intended element (ChatGPT's
 * send and voice buttons share the composer classes). The pick is accepted only
 * when some attempt agrees with the fingerprint; that attempt's selector is
 * stored as the primary, because it is the one the app can actually resolve.
 * A selector outside the submitted candidates means the runtime fell back to
 * fingerprint/semantic recovery, which is not evidence for a stored primary.
 */
function verifyPick(
  raw: unknown,
  payload: SelectorTransferPayload
): { ok: true; selector: string; candidates: string[] } | { ok: false; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: 'no_result' }
  const result = raw as VerificationResult
  // An empty result has no field either; "found nothing" is the honest reason.
  const attempts = verificationAttempts(result)
  if (attempts.length === 0) return { ok: false, reason: 'not_found' }
  if (result.field !== payload.field) return { ok: false, reason: 'field_mismatch' }
  if (result.diagnostics?.[payload.field]?.ambiguous === true) {
    return { ok: false, reason: 'ambiguous' }
  }

  const candidates = payload.candidates.map((candidate) => candidate.trim())
  /** Candidates that resolved to a *different* element in the app's DOM. */
  const conflicting = new Set<string>()
  let verifiedSelector: string | null = null
  /** Distinct elements the matching attempts resolved to. */
  const verifiedElements = new Set<string>()
  let sawMismatch = false
  let sawUnknownMatch = false
  let sawUnstable = false
  let sawInsufficient = false

  for (const attempt of attempts) {
    if (typeof attempt.matchedSelector !== 'string') continue
    const matched = attempt.matchedSelector.trim()
    if (!candidates.includes(matched)) {
      sawUnknownMatch = true
      continue
    }
    if (attempt.strategy !== 'direct' && attempt.strategy !== 'candidate') {
      sawUnstable = true
      continue
    }
    // The verifier names the candidate it actually resolved; `matchedSelector`
    // can differ when the runtime fell back to another candidate.
    const sourceSelector =
      typeof attempt.selector === 'string' && candidates.includes(attempt.selector.trim())
        ? attempt.selector.trim()
        : matched
    const verdict = compareDescriptorToFingerprint(attempt.descriptor, payload.fingerprint)
    if (verdict === 'mismatch') {
      sawMismatch = true
      conflicting.add(sourceSelector)
      continue
    }
    if (verdict === 'insufficient') {
      sawInsufficient = true
      continue
    }
    if (!verifiedSelector) verifiedSelector = matched
    if (typeof attempt.elementKey === 'number') {
      verifiedElements.add(String(attempt.elementKey))
    } else {
      // An older verifier reported no element identity; the matched selector
      // is the best identity it could prove.
      verifiedElements.add(matched)
    }
  }

  if (verifiedElements.size > 1) {
    // Two candidates agree with the fingerprint but resolved to different
    // elements. Which one the runtime would act on is its priority order, not
    // the user's pick, so nothing is stored.
    return { ok: false, reason: 'ambiguous' }
  }

  if (!verifiedSelector) {
    if (sawMismatch) return { ok: false, reason: 'identity_mismatch' }
    if (sawInsufficient) return { ok: false, reason: 'identity_insufficient' }
    if (sawUnknownMatch) return { ok: false, reason: 'unknown_match' }
    if (sawUnstable) return { ok: false, reason: 'unstable_strategy' }
    return { ok: false, reason: 'no_match' }
  }

  // The runtime orders candidates by its own priority, not by the stored order.
  // A candidate that resolved to a *different* element here would therefore be
  // preferred over the verified one at automation time (a class candidate that
  // matches the voice button outranks a generic `button`). It is dropped from
  // the stored list; the verified selector becomes the primary, and the
  // remaining candidates stay as fallbacks.
  const safeCandidates: string[] = [verifiedSelector]
  for (const candidate of candidates) {
    if (candidate === verifiedSelector || conflicting.has(candidate)) continue
    safeCandidates.push(candidate)
  }
  return { ok: true, selector: verifiedSelector, candidates: safeCandidates }
}

export function createSelectorIngest(deps: SelectorIngestDeps) {
  return async function ingest(raw: unknown): Promise<SelectorIngestResult> {
    const parsed = parseSelectorTransferPayload(raw)
    if ('reason' in parsed) return { status: 'invalid_payload', reason: parsed.reason }
    const payload = parsed.payload

    const sites = await deps.loadSites()
    const sourcePath = urlPathOf(payload.sourceUrl)
    const sourceMatch = findSelectorSiteMatch(payload.hostname, sites, sourcePath)
    if (!sourceMatch) return { status: 'unknown_site' }
    if (sourceMatch.ambiguous) return { status: 'ambiguous_site' }
    const site = sourceMatch.site
    // The extension names the site it resolved. A different answer means the
    // two catalogues disagree (a registry change between pick and transfer), and
    // the hostname must not be allowed to silently pick another site.
    if (payload.siteId && payload.siteId !== site.siteId) {
      return { status: 'invalid_payload', reason: 'site_id_mismatch' }
    }
    if (!site.fields.includes(payload.field))
      return { status: 'invalid_payload', reason: 'unsupported_field' }

    const view = await deps.findViewForSite(site)
    if (!view) return { status: 'site_not_open' }

    const viewHost = normalizeUrlHost(view.url)
    if (!viewHost) return { status: 'verification_failed', reason: 'invalid_view_url' }
    // The view has to be the same *site*, not merely a host that happens to
    // match a suffix: a view on another site must never verify this selector.
    // The pick's path also has to belong to the entry, so an unrelated login or
    // account page on the same host cannot be stored as the site's composer.
    const viewMatch = findSelectorSiteMatch(viewHost, sites, urlPathOf(view.url))
    if (!viewMatch || viewMatch.ambiguous || viewMatch.site.siteId !== site.siteId) {
      return { status: 'verification_failed', reason: 'view_site_mismatch' }
    }

    const script = generateVerifyLocatorScript({
      field: payload.field,
      selectors: payload.candidates,
      fingerprint: payload.fingerprint
    })

    let rawResult: unknown
    try {
      rawResult = await deps.executeScript(view.viewId, script)
    } catch {
      return { status: 'verification_failed', reason: 'verification_threw' }
    }
    const verified = verifyPick(rawResult, payload)
    if (!verified.ok) {
      deps.logVerificationFailure?.(summarizePickFailure(payload, verified.reason, rawResult))
      return { status: 'verification_failed', reason: verified.reason }
    }
    const verifiedSelector = verified.selector

    // The view may navigate while the verifier runs (a redirect, a SPA route
    // change, a reload). A result from a document that is no longer the one the
    // view shows must not be stored: the next automation would look it up in a
    // different document. The verifier reports the address it ran on, and the
    // live view address is read again *after* the script.
    const afterUrl = await deps.getViewUrl(view.viewId).catch(() => null)
    if (!afterUrl || afterUrl !== view.url) {
      return { status: 'verification_failed', reason: 'view_navigated' }
    }
    const resultHref = readResultHref(rawResult)
    if (resultHref && normalizeUrlHost(resultHref) !== viewHost) {
      return { status: 'verification_failed', reason: 'view_navigated' }
    }

    // The config is keyed by the address the automation will run on, which is
    // the Electron view's host — a Chrome redirect between the two hosts must
    // not aim the stored locator at a key nothing looks up.
    const storedHost = viewHost
    const existing = deps.readConfigs ? (await deps.readConfigs())[storedHost] : undefined

    // Only the field this pick describes is replaced. The other field's staged
    // repair state, health evidence and candidates stay exactly as they were;
    // otherwise picking the input would silently cure a broken button.
    const fieldPatch: AiSelectorConfig =
      payload.field === 'input'
        ? {
            input: verifiedSelector,
            inputCandidates: verified.candidates,
            inputFingerprint: payload.fingerprint
          }
        : {
            button: verifiedSelector,
            buttonCandidates: verified.candidates,
            buttonFingerprint: payload.fingerprint
          }

    const patch: AiSelectorConfig = {
      ...fieldPatch,
      version: 2,
      sourceUrl: storedSourceUrl(view.url),
      sourceHostname: storedHost,
      canonicalHostname: canonicalizeHostname(storedHost) || storedHost,
      ...locatorHealthPatch(existing, payload.field)
    }

    const saved = await deps.savePatch(storedHost, patch)
    if (!saved) return { status: 'save_failed' }

    deps.broadcastConfigChanged(storedHost)
    return { status: 'saved', hostname: storedHost, field: payload.field }
  }
}

/** The path of an https URL, or undefined when it has none. */
function urlPathOf(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const parsed = new URL(value)
    return parsed.pathname || '/'
  } catch {
    return undefined
  }
}

/**
 * The address stored with a pick, without query string or fragment.
 *
 * A pick only needs to record where it came from; a chat URL's query or hash
 * can carry conversation identifiers that have no place in a selector record.
 */
function storedSourceUrl(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    return `${parsed.origin}${parsed.pathname || '/'}`
  } catch {
    return null
  }
}

/**
 * The address a verifier reports it ran on.
 *
 * The verifier is generated source, so the field is read defensively; an older
 * verifier simply has no `href` and the live view check above remains.
 */
function readResultHref(raw: unknown): string | null {
  if (!isRecord(raw)) return null
  const href = raw.href
  return typeof href === 'string' && href ? href : null
}

/** A failure summary with no page content, prompt text or raw descriptor. */
function summarizePickFailure(
  payload: SelectorTransferPayload,
  reason: string,
  raw: unknown
): SelectorPickFailure {
  const result = isRecord(raw) ? (raw as VerificationResult) : {}
  const has = (value: unknown) => typeof value === 'string' && value.length > 0
  return {
    hostname: payload.hostname,
    field: payload.field,
    reason,
    tag: payload.fingerprint.tag,
    identity: {
      role: has(payload.fingerprint.role),
      type: has(payload.fingerprint.type),
      dataTestId: has(payload.fingerprint.dataTestId),
      id: has(payload.fingerprint.safeId),
      name: has(payload.fingerprint.name),
      ariaLabel: has(payload.fingerprint.ariaLabel),
      placeholder: has(payload.fingerprint.placeholder),
      text: has(payload.fingerprint.text),
      contentEditable: payload.fingerprint.contentEditable === true
    },
    verifier: {
      matchedSelector: typeof result.matchedSelector === 'string' ? result.matchedSelector : null,
      strategy: typeof result.strategy === 'string' ? result.strategy : null,
      attempts: Array.isArray(result.attempts) ? result.attempts.length : 0,
      ambiguous: result.diagnostics?.[payload.field]?.ambiguous === true
    }
  }
}

/**
 * The health/repair part of a one-field pick.
 *
 * `health` is site-wide while `repair` is per locator. A pick clears only its
 * own staged repair. When `needs_repick` was caused by this locator's staged
 * candidate it becomes `ready` again; a problem staged for the other locator
 * keeps the site in `needs_repick`, because this pick says nothing about it.
 */
function locatorHealthPatch(
  existing: AiSelectorConfig | undefined,
  field: SelectorField
): Pick<AiSelectorConfig, 'health' | 'repair'> {
  const previousRepair = existing?.repair ?? null
  let nextRepair = previousRepair
  if (previousRepair) {
    const remaining: NonNullable<AiSelectorConfig['repair']> = { ...previousRepair }
    delete remaining[field]
    nextRepair = remaining.input || remaining.button ? remaining : null
  }

  const other: SelectorField = field === 'input' ? 'button' : 'input'
  let health: NonNullable<AiSelectorConfig['health']> = 'ready'
  if (existing?.health === 'needs_repick') {
    // Keep the flag when the other locator still has a staged repair, or when
    // nothing attributes the flag to the locator this pick just verified.
    const attributedToThisPick = Boolean(previousRepair?.[field])
    const otherStillBroken = Boolean(previousRepair?.[other])
    health = otherStillBroken || !attributedToThisPick ? 'needs_repick' : 'ready'
  }

  return { health, repair: nextRepair }
}
