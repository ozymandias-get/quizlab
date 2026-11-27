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
import { normalizeHostname } from './aiConfigSanitize.js'
import { matchSelectorSite, type SelectorSiteTarget } from './selectorTargets.js'

/** The largest fingerprint the transfer accepts; the sanitizer bounds it again. */
const MAX_FINGERPRINT_TAG_LENGTH = 32
const MAX_CANDIDATES = 12
const MAX_URL_LENGTH = 2048

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
  broadcastConfigChanged: (hostname: string) => void
  /**
   * Records why a pick was not accepted.
   *
   * The refusal reason is what turns "the selector did not verify" into an
   * actionable report; the raw verifier result carries the matched selector and
   * the descriptor the app resolved.
   */
  logVerificationFailure?: (details: {
    hostname: string
    field: SelectorField
    reason: string
    fingerprint: AutomationElementFingerprint
    result: unknown
  }) => void
}

/** The result of one ingestion, mapped to HTTP by the bridge. */
export type SelectorIngestResult =
  | { status: 'saved'; hostname: string; field: SelectorField }
  | { status: 'invalid_payload'; reason: string }
  | { status: 'unknown_site' }
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
  matchedSelector?: unknown
  strategy?: unknown
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
      field: raw.field,
      selector,
      candidates,
      fingerprint: fingerprint as unknown as AutomationElementFingerprint,
      sourceUrl: raw.sourceUrl
    }
  }
}

function normalizeComparisonText(value: unknown): string {
  return typeof value === 'string' ? value.replaceAll(/\s+/g, ' ').trim() : ''
}

/**
 * Whether the element the Electron view resolved is the element Chrome picked.
 *
 * `findUniqueSelectorMatch` accepts a *unique* match without consulting the
 * fingerprint, which is correct inside one document but not across browsers:
 * the same selector can match one different element in the app's DOM. The
 * descriptor returned by the verifier closes that gap. Every identity field the
 * user's pick carries must agree; a missing or different attribute means a
 * different element.
 */
function descriptorMatchesFingerprint(
  descriptor: VerificationDescriptor | null | undefined,
  fingerprint: AutomationElementFingerprint
): boolean {
  if (!isRecord(descriptor)) return false
  if (typeof descriptor.tag !== 'string' || !descriptor.tag) return false
  if (descriptor.tag.toLowerCase() !== fingerprint.tag.toLowerCase()) return false

  const attributeMatches = (actual: unknown, expected: string | null | undefined): boolean => {
    if (typeof expected !== 'string' || expected.length === 0) return true
    // The two browsers can render the same control differently: a value the
    // app's DOM does not expose is missing evidence, not a contradiction. A
    // *present* value that differs still rejects the element.
    if (typeof actual !== 'string' || actual.length === 0) return true
    return actual === expected
  }

  if (!attributeMatches(descriptor.role, fingerprint.role)) return false
  if (!attributeMatches(descriptor.type, fingerprint.type)) return false
  if (!attributeMatches(descriptor.dataTestId, fingerprint.dataTestId)) return false
  if (!attributeMatches(descriptor.id, fingerprint.safeId)) return false
  if (!attributeMatches(descriptor.ariaLabel, fingerprint.ariaLabel)) return false
  if (!attributeMatches(descriptor.placeholder, fingerprint.placeholder)) return false
  if (!attributeMatches(descriptor.name, fingerprint.name)) return false
  if (fingerprint.contentEditable === true && descriptor.contentEditable !== true) return false
  const expectedText = normalizeComparisonText(fingerprint.text)
  const actualText = normalizeComparisonText(descriptor.text)
  if (expectedText.length > 0 && actualText.length > 0 && actualText !== expectedText) {
    return false
  }
  return true
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
): { ok: true; selector: string } | { ok: false; reason: string } {
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
  let reason = 'identity_mismatch'
  for (const attempt of attempts) {
    if (typeof attempt.matchedSelector !== 'string') {
      reason = 'no_match'
      continue
    }
    const matched = attempt.matchedSelector.trim()
    if (!candidates.includes(matched)) {
      reason = 'unknown_match'
      continue
    }
    if (attempt.strategy !== 'direct' && attempt.strategy !== 'candidate') {
      reason = 'unstable_strategy'
      continue
    }
    if (!descriptorMatchesFingerprint(attempt.descriptor, payload.fingerprint)) {
      reason = 'identity_mismatch'
      continue
    }
    return { ok: true, selector: matched }
  }
  return { ok: false, reason }
}

export function createSelectorIngest(deps: SelectorIngestDeps) {
  return async function ingest(raw: unknown): Promise<SelectorIngestResult> {
    const parsed = parseSelectorTransferPayload(raw)
    if ('reason' in parsed) return { status: 'invalid_payload', reason: parsed.reason }
    const payload = parsed.payload

    const sites = await deps.loadSites()
    const site = matchSelectorSite(payload.hostname, sites)
    if (!site) return { status: 'unknown_site' }
    if (!site.fields.includes(payload.field))
      return { status: 'invalid_payload', reason: 'unsupported_field' }

    const view = await deps.findViewForSite(site)
    if (!view) return { status: 'site_not_open' }

    const viewHost = normalizeUrlHost(view.url)
    if (!viewHost) return { status: 'verification_failed', reason: 'invalid_view_url' }
    // The view has to be the same *site*, not merely a host that happens to
    // match a suffix: a view on another site must never verify this selector.
    const viewSite = matchSelectorSite(viewHost, sites)
    if (!viewSite || viewSite.siteId !== site.siteId) {
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
      deps.logVerificationFailure?.({
        hostname: payload.hostname,
        field: payload.field,
        reason: verified.reason,
        fingerprint: payload.fingerprint,
        result: rawResult
      })
      return { status: 'verification_failed', reason: verified.reason }
    }
    const verifiedSelector = verified.selector

    // The config is keyed by the address the automation will run on, which is
    // the Electron view's host — a Chrome redirect between the two hosts must
    // not aim the stored locator at a key nothing looks up.
    const storedHost = viewHost
    const fieldPatch: AiSelectorConfig =
      payload.field === 'input'
        ? {
            input: verifiedSelector,
            inputCandidates: payload.candidates,
            inputFingerprint: payload.fingerprint
          }
        : {
            button: verifiedSelector,
            buttonCandidates: payload.candidates,
            buttonFingerprint: payload.fingerprint
          }

    const patch: AiSelectorConfig = {
      ...fieldPatch,
      version: 2,
      sourceUrl: view.url,
      sourceHostname: storedHost,
      canonicalHostname: canonicalizeHostname(storedHost) || storedHost,
      health: 'ready',
      repair: null
    }

    const saved = await deps.savePatch(storedHost, patch)
    if (!saved) return { status: 'save_failed' }

    deps.broadcastConfigChanged(storedHost)
    return { status: 'saved', hostname: storedHost, field: payload.field }
  }
}
