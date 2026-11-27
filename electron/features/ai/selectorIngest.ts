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
  isSelectorRequestId,
  isSelectorTransferField,
  SELECTOR_TRANSFER_VERSION,
  type SelectorField,
  type SelectorLocatorBundle,
  type SelectorTransferField,
  type SelectorTransferPayload
} from '../../../shared/constants/selectorTransfer.js'
import { canonicalizeHostname } from '../../../shared/selectorConfig.js'
import { isPersistableSelector } from '../../../shared/selectorRepair/selectorValidation.js'
import { generateVerifyLocatorScript } from '../automation/automationScripts/generators/verifyLocator.js'
import { type AiConfigMap, locatorHealthPatch, resolveConfigForHostname } from './aiConfigDomain.js'
import { sanitizeFingerprint } from './aiConfigFingerprint.js'
import { normalizeHostname } from './aiConfigSanitize.js'
import { findSelectorSiteMatch, type SelectorSiteTarget } from './selectorTargets.js'

/** The largest fingerprint the transfer accepts; the sanitizer bounds it again. */
const MAX_FINGERPRINT_TAG_LENGTH = 32
const MAX_CANDIDATES = 12
const MAX_URL_LENGTH = 2048
const MAX_SITE_ID_LENGTH = 120

const SEND_LIKE_PATTERN =
  /\b(send|gönder|gonder|submit|reply|yanıtla|yanitla)\b|send-?message|sendmessage|send_message|composer-?send|send-button|sendbutton|submit_message|message_send|send_/i
const NON_SEND_CONTROL_PATTERN =
  /(^|\s|-|_)(mikrofon|sesli|dikte|konuş|konus|mic|microphone|dictate|dictation|voice|speak|speech|talk|record|recording|transcribe|transcription|audio|attach|attachment|upload|file|dosya|ekle|camera|kamera|image|photo|görsel|gorsel|add-file)(\s|-|_|$)/i

/** What a live managed view is, for the verification. */
export interface SelectorLiveView {
  viewId: string
  url: string
  /** Opaque token tied to the view generation and document revision. */
  documentToken?: string
}

/** Everything the ingestion needs from the process, injectable for tests. */
export interface SelectorIngestDeps {
  loadSites: () => Promise<SelectorSiteTarget[]>
  /** Every stored config, keyed by hostname. */
  readConfigs: () => Promise<Record<string, AiSelectorConfig>>
  savePatch: (
    hostname: string,
    patch: AiSelectorConfig,
    field?: SelectorTransferField
  ) => Promise<boolean>
  /** The managed view whose page belongs to this site, or null. */
  findViewForSite: (
    site: SelectorSiteTarget,
    sites?: readonly SelectorSiteTarget[]
  ) => Promise<SelectorLiveView | null>
  executeScript: (viewId: string, script: string) => Promise<unknown>
  /** The view's address after the script ran, or null when it is gone. */
  getViewUrl: (viewId: string) => Promise<string | null>
  /** The view's document lifecycle token, or null when the view is gone. */
  getViewDocumentToken?: (viewId: string) => Promise<string | null>
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
    matched: boolean
    matchedInCandidates: boolean
    strategy: string | null
    attempts: number
    ambiguous: boolean
    /** `ran` when the empty-composer probe executed, `skipped` when it could not. */
    probe: string | null
    /** How the probe left the composer (`cleared`, `left_external_edit`, ...). */
    cleanup: string | null
    /** Structural shape of the first resolved candidate; no text or labels. */
    descriptor?: {
      tag: string | null
      type: string | null
      role: string | null
      contentEditable: boolean
      dataTestId: boolean
      id: boolean
      name: boolean
      tagAgrees: boolean
    }
  }
}

/** The result of one ingestion, mapped to HTTP by the bridge. */
export type SelectorIngestResult =
  | { status: 'saved'; hostname: string; field: SelectorTransferField }
  | { status: 'invalid_payload'; reason: string }
  | { status: 'unknown_site' }
  | { status: 'ambiguous_site' }
  | { status: 'site_not_open' }
  | { status: 'verification_failed'; reason: string; failedField?: SelectorField }
  | { status: 'save_failed' }

interface VerificationDescriptor {
  tag?: unknown
  role?: unknown
  type?: unknown
  id?: unknown
  dataTestId?: unknown
  ariaLabel?: unknown
  placeholder?: unknown
  title?: unknown
  name?: unknown
  dataComposerSubmit?: unknown
  hasDictationAttr?: unknown
  contentEditable?: unknown
  classTokens?: unknown
  text?: unknown
}

interface VerificationResult {
  success?: unknown
  field?: unknown
  href?: unknown
  matchedSelector?: unknown
  strategy?: unknown
  descriptor?: VerificationDescriptor | null
  attempts?: unknown
  composerState?: unknown
  probe?: unknown
  cleanup?: unknown
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

function parseLocatorBundle(
  raw: unknown,
  field: SelectorField,
  prefix = ''
): { bundle: SelectorLocatorBundle } | { reason: string } {
  if (!isRecord(raw)) return { reason: `${prefix}not_an_object` }

  const rawSelector = raw.selector
  if (typeof rawSelector !== 'string' || !isPersistableSelector(rawSelector)) {
    return { reason: `${prefix}invalid_selector` }
  }
  const selector = rawSelector.trim()

  if (!Array.isArray(raw.candidates) || raw.candidates.length === 0) {
    return { reason: `${prefix}missing_candidates` }
  }
  if (raw.candidates.length > MAX_CANDIDATES) return { reason: `${prefix}too_many_candidates` }
  const candidates: string[] = []
  for (const candidate of raw.candidates) {
    if (!isPersistableSelector(candidate)) return { reason: `${prefix}invalid_candidate` }
    const normalized = candidate.trim()
    if (!candidates.includes(normalized)) candidates.push(normalized)
  }
  if (!candidates.includes(selector)) return { reason: `${prefix}primary_not_in_candidates` }

  const fingerprint = raw.fingerprint
  if (!isRecord(fingerprint)) return { reason: `${prefix}missing_fingerprint` }
  if (typeof fingerprint.tag !== 'string' || !fingerprint.tag.trim()) {
    return { reason: `${prefix}missing_fingerprint_tag` }
  }
  if (fingerprint.tag.length > MAX_FINGERPRINT_TAG_LENGTH) {
    return { reason: `${prefix}fingerprint_tag_too_long` }
  }
  // The same field-by-field sanitizer the config store applies: unknown keys are
  // dropped, values are length-bounded and a fingerprint that does not describe
  // an element at all is refused. Validating here means the verifier and the
  // stored fingerprint are the same object, not a cast of the wire value.
  const sanitizedFingerprint = sanitizeFingerprint(fingerprint)
  if (!sanitizedFingerprint) return { reason: `${prefix}invalid_fingerprint` }
  if (field === 'input' && sanitizedFingerprint.text !== undefined) {
    delete sanitizedFingerprint.text
  }

  return {
    bundle: {
      selector,
      candidates,
      fingerprint: sanitizedFingerprint
    }
  }
}

/**
 * Parses and bounds one transfer payload (single field or guided pair).
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
  if (!isSelectorTransferField(raw.field)) return { reason: 'invalid_field' }

  const hostname = normalizeHostname(raw.hostname)
  if (!hostname) return { reason: 'invalid_hostname' }

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

  if (raw.field === 'pair') {
    const inputParsed = parseLocatorBundle(raw.input, 'input', 'input_')
    if ('reason' in inputParsed) return inputParsed
    const buttonParsed = parseLocatorBundle(raw.button, 'button', 'button_')
    if ('reason' in buttonParsed) return buttonParsed
    return {
      payload: {
        version: SELECTOR_TRANSFER_VERSION,
        requestId: raw.requestId,
        hostname,
        ...(siteId ? { siteId } : {}),
        field: 'pair',
        input: inputParsed.bundle,
        button: buttonParsed.bundle,
        sourceUrl: raw.sourceUrl.trim()
      }
    }
  }

  const parsedBundle = parseLocatorBundle(raw, raw.field)
  if ('reason' in parsedBundle) return parsedBundle

  return {
    payload: {
      version: SELECTOR_TRANSFER_VERSION,
      requestId: raw.requestId,
      hostname,
      ...(siteId ? { siteId } : {}),
      field: raw.field,
      ...parsedBundle.bundle,
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

function isDistinctiveSemanticValue(value: string, expectedTag: string): boolean {
  if (value.length < 2) return false
  if (value === expectedTag.toLowerCase()) return false
  return /[\p{L}\p{N}]/u.test(value)
}

function stringListOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function hasSendLikeSignal(values: Array<string | null | undefined>): boolean {
  return values.some((value) => typeof value === 'string' && SEND_LIKE_PATTERN.test(value))
}

function hasNonSendControlSignal(values: Array<string | null | undefined>): boolean {
  return values.some((value) => typeof value === 'string' && NON_SEND_CONTROL_PATTERN.test(value))
}

function isRealTextEntryDescriptor(descriptor: VerificationDescriptor, tag: string): boolean {
  const lowerTag = tag.toLowerCase()
  if (lowerTag === 'textarea') return true
  if (lowerTag === 'input') {
    const type = (presentString(descriptor.type) || 'text').toLowerCase()
    return ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''].includes(type)
  }
  return descriptor.contentEditable === true
}

function countSharedClassTokens(actual: unknown, expected: string[] | null | undefined): number {
  if (!Array.isArray(expected) || expected.length === 0) return 0
  const actualTokens = new Set(stringListOf(actual))
  let shared = 0
  for (const token of expected) {
    if (actualTokens.has(token)) shared += 1
  }
  return shared
}

/**
 * Compares the element the Electron view resolved with the element Chrome
 * picked.
 *
 * Three outcomes, because "the attribute is missing" is not the same answer as
 * "the attribute says this is another element":
 *
 *   - `mismatch`: a stable or structural attribute (`tag`, `role`, `type`,
 *     `dataTestId`, `id`, `name`, `contentEditable`) is present on both sides
 *     and differs. The element is definitely not the pick.
 *   - `insufficient`: nothing contradicts the pick, but only generic traits
 *     (`tag`, `role`, `type`, `contentEditable`, `classTokens`) agreed without
 *     any strong identity (`dataTestId`, `id`, `name`) or field-distinctive
 *     semantic match (`ariaLabel`, `placeholder` for input; `ariaLabel`, `text`,
 *     `title`, `dataComposerSubmit` or cross-locale send signal for button).
 *   - `match`: at least one strong identity or field-distinctive semantic field
 *     agrees and nothing stable/structural contradicts it.
 *
 * Localisable text (`text`, `aria-label`, `placeholder`) only ever *adds*
 * evidence. A site rendered in another language does not reject a pick whose
 * stable identity or structural/semantic role agrees, while voice, mic and
 * attachment controls are strictly prevented from masquerading as send buttons.
 */
function compareDescriptorToFingerprint(
  descriptor: VerificationDescriptor | null | undefined,
  fingerprint: AutomationElementFingerprint,
  field: SelectorField,
  matchedSelector?: string
): IdentityVerdict {
  if (!isRecord(descriptor)) return 'insufficient'
  const actualTag = presentString(descriptor.tag)
  const expectedTag = presentString(fingerprint.tag)
  if (!actualTag || !expectedTag) return 'insufficient'
  if (actualTag.toLowerCase() !== expectedTag.toLowerCase()) return 'mismatch'

  let strongMatches = 0

  const strongFields: Array<{
    actual: unknown
    expected: string | null | undefined
  }> = [
    { actual: descriptor.dataTestId, expected: fingerprint.dataTestId },
    { actual: descriptor.id, expected: fingerprint.safeId },
    { actual: descriptor.name, expected: fingerprint.name }
  ]
  for (const entry of strongFields) {
    const expected = presentString(entry.expected)
    if (!expected) continue
    const actual = presentString(entry.actual)
    // Missing on the app's side is missing evidence, not a contradiction.
    if (!actual) continue
    if (actual !== expected) return 'mismatch'
    strongMatches += 1
  }

  const structuralFields: Array<{
    actual: unknown
    expected: string | null | undefined
  }> = [
    { actual: descriptor.role, expected: fingerprint.role },
    { actual: descriptor.type, expected: fingerprint.type }
  ]
  for (const entry of structuralFields) {
    const expected = presentString(entry.expected)
    if (!expected) continue
    const actual = presentString(entry.actual)
    if (!actual) continue
    if (actual.toLowerCase() !== expected.toLowerCase()) return 'mismatch'
  }

  if (fingerprint.contentEditable === true && descriptor.contentEditable !== true) {
    return 'mismatch'
  }

  const descriptorSignals = [
    presentString(descriptor.ariaLabel),
    presentString(descriptor.title),
    presentString(descriptor.dataTestId),
    presentString(descriptor.name),
    presentString(descriptor.text)
  ]
  const fingerprintSignals = [
    presentString(fingerprint.ariaLabel),
    presentString(fingerprint.dataTestId),
    presentString(fingerprint.name),
    presentString(fingerprint.text),
    ...stringListOf(fingerprint.classTokens)
  ]

  // Strict anti-confusion guard for send buttons: dictation, voice mode,
  // microphone, and attachment controls must never pass as a send button.
  if (field === 'button') {
    const descriptorIsSend =
      descriptor.dataComposerSubmit === true ||
      hasSendLikeSignal([
        presentString(descriptor.ariaLabel),
        presentString(descriptor.title),
        presentString(descriptor.dataTestId),
        presentString(descriptor.name),
        ...stringListOf(descriptor.classTokens)
      ])
    const descriptorIsNonSend =
      descriptor.hasDictationAttr === true || hasNonSendControlSignal(descriptorSignals)
    if (descriptorIsNonSend && !descriptorIsSend) {
      return 'insufficient'
    }
    if (
      descriptor.dataComposerSubmit === true &&
      (matchedSelector === '[data-composer-submit]' || hasSendLikeSignal(fingerprintSignals))
    ) {
      strongMatches += 1
    }
  }

  let distinctiveSemanticMatches = 0
  const semanticFields: Array<{ actual: unknown; expected: string | null | undefined }> =
    field === 'input'
      ? [
          { actual: descriptor.ariaLabel, expected: fingerprint.ariaLabel },
          { actual: descriptor.placeholder, expected: fingerprint.placeholder }
        ]
      : [
          { actual: descriptor.ariaLabel, expected: fingerprint.ariaLabel },
          { actual: descriptor.text, expected: fingerprint.text },
          { actual: descriptor.title, expected: fingerprint.ariaLabel }
        ]
  for (const entry of semanticFields) {
    const expected = normalizeComparisonText(entry.expected)
    if (!expected) continue
    const actual = normalizeComparisonText(entry.actual)
    if (!actual) continue
    if (actual === expected && isDistinctiveSemanticValue(actual, expectedTag)) {
      distinctiveSemanticMatches += 1
    }
  }

  // Cross-language send-button semantic agreement (e.g. Chrome TR "Mesaj gönder"
  // vs Electron EN "Send message").
  if (
    field === 'button' &&
    distinctiveSemanticMatches === 0 &&
    (descriptor.dataComposerSubmit === true || hasSendLikeSignal(descriptorSignals)) &&
    hasSendLikeSignal(fingerprintSignals)
  ) {
    distinctiveSemanticMatches += 1
  }

  // Cross-language editor agreement for localized composers without id/data-testid
  // (e.g. Gemini `div.ql-editor[contenteditable="true"][role="textbox"]` or ProseMirror).
  if (
    field === 'input' &&
    strongMatches === 0 &&
    distinctiveSemanticMatches === 0 &&
    isRealTextEntryDescriptor(descriptor, actualTag)
  ) {
    const sharedClasses = countSharedClassTokens(descriptor.classTokens, fingerprint.classTokens)
    const bothTextbox =
      presentString(descriptor.role)?.toLowerCase() === 'textbox' &&
      presentString(fingerprint.role)?.toLowerCase() === 'textbox'
    const bothEditable = fingerprint.contentEditable === true && descriptor.contentEditable === true
    const bothHavePromptLabel =
      (Boolean(presentString(descriptor.placeholder)) &&
        Boolean(presentString(fingerprint.placeholder))) ||
      (Boolean(presentString(descriptor.ariaLabel)) &&
        Boolean(presentString(fingerprint.ariaLabel)))
    if (
      (bothEditable && (bothTextbox || sharedClasses > 0)) ||
      (actualTag.toLowerCase() === 'textarea' &&
        (sharedClasses > 0 || bothTextbox || bothHavePromptLabel))
    ) {
      distinctiveSemanticMatches += 1
    }
  }

  return strongMatches > 0 || distinctiveSemanticMatches > 0 ? 'match' : 'insufficient'
}

/** Mirrors `__SELECTOR_PRIORITY` in `selectorEngine.ts` so stored order matches runtime lookup. */
export function selectorPriority(selector: string): number {
  const s = selector.trim()
  if (!s) return 0
  if (/^#[a-zA-Z][\w-]*$/.test(s)) return 100
  if (/\[(?:data-testid|data-test-id)\s*=/.test(s)) return 90
  if (/\[aria-label\s*=/.test(s)) return 75
  if (/\[role\s*=/.test(s)) return 65
  if (/\[name\s*=/.test(s)) return 60
  if (/\[placeholder\s*=/.test(s)) return 50
  if (/\[type\s*=/.test(s)) return 45
  if (/\[contenteditable/.test(s)) return 40
  if (/^\w+\.[\w.-]+/.test(s) || /^\w+\[class\*=/.test(s)) return 25
  if (/:nth-child\(/.test(s)) return 10
  return 0
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

function isEmptyComposerButtonFailure(raw: unknown, field: SelectorField): boolean {
  if (field !== 'button' || !isRecord(raw)) return false
  const state = raw.composerState
  return state === 'empty_probe_no_button' || state === 'empty_unknown_input'
}

/**
 * Verdicts worth a composer probe.
 *
 * `ambiguous` is deliberately excluded: the app already found two elements that
 * could be the pick, and typing into the composer could produce the same
 * ambiguity after mutating the user's composer — a worse trade than refusing.
 * `view_navigated`, `verification_threw` and `field_mismatch` are terminal.
 */
const PROBE_ELIGIBLE = new Set([
  'not_found',
  'button_not_rendered_empty_composer',
  'identity_mismatch',
  'identity_insufficient'
])

/** Whether the probe script ran, and why it may not have. */
function readProbeState(raw: unknown): 'ran' | 'non_empty' | 'no_input' | 'not_run' | 'unknown' {
  if (!isRecord(raw)) return 'unknown'
  if (raw.probe === 'ran') return 'ran'
  if (raw.composerState === 'non_empty') return 'non_empty'
  if (raw.composerState === 'no_input') return 'no_input'
  if (raw.probe === 'not_run') return 'not_run'
  return 'unknown'
}

/**
 * How the probe left the composer.
 *
 * `cleared` is the only outcome that proves the probe removed exactly what it
 * wrote. `element_replaced`, `left_external_edit`, `content_changed` and
 * `failed` all mean the app cannot prove the state it left behind.
 */
function readProbeCleanup(raw: unknown): string | null {
  if (!isRecord(raw)) return null
  return typeof raw.cleanup === 'string' && raw.cleanup ? raw.cleanup : null
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
  field: SelectorField,
  bundle: SelectorLocatorBundle
): { ok: true; selector: string; candidates: string[] } | { ok: false; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: 'no_result' }
  const result = raw as VerificationResult
  // The field has to be right before any verdict is trusted: a stale or failed
  // script answer must not be read as an eligible "nothing found" result.
  if (result.field !== field) return { ok: false, reason: 'field_mismatch' }
  const attempts = verificationAttempts(result)
  if (attempts.length === 0) {
    return {
      ok: false,
      reason: isEmptyComposerButtonFailure(raw, field)
        ? 'button_not_rendered_empty_composer'
        : 'not_found'
    }
  }
  if (result.diagnostics?.[field]?.ambiguous === true) {
    return { ok: false, reason: 'ambiguous' }
  }

  const candidates = bundle.candidates.map((candidate) => candidate.trim())
  /** Candidates that resolved to a *different* element in the app's DOM. */
  const conflicting = new Set<string>()
  const verifiedSelectors: string[] = []
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
    if (
      attempt.strategy !== 'direct' &&
      attempt.strategy !== 'candidate' &&
      attempt.strategy !== 'recursive'
    ) {
      sawUnstable = true
      continue
    }
    // The verifier names the candidate it actually resolved; `matchedSelector`
    // can differ when the runtime fell back to another candidate.
    const sourceSelector =
      typeof attempt.selector === 'string' && candidates.includes(attempt.selector.trim())
        ? attempt.selector.trim()
        : matched
    const verdict = compareDescriptorToFingerprint(
      attempt.descriptor,
      bundle.fingerprint,
      field,
      matched
    )
    if (verdict === 'mismatch') {
      sawMismatch = true
      conflicting.add(sourceSelector)
      conflicting.add(matched)
      continue
    }
    if (verdict === 'insufficient') {
      sawInsufficient = true
      continue
    }
    if (!verifiedSelectors.includes(matched)) {
      verifiedSelectors.push(matched)
    }
    if (typeof attempt.elementKey === 'number') {
      verifiedElements.add(String(attempt.elementKey))
    } else {
      verifiedElements.add(matched)
    }
  }

  if (verifiedElements.size > 1) {
    return { ok: false, reason: 'ambiguous' }
  }

  const safeCandidates = verifiedSelectors
    .filter((candidate) => !conflicting.has(candidate))
    .sort((left, right) => {
      const diff = selectorPriority(right) - selectorPriority(left)
      if (diff !== 0) return diff
      return left < right ? -1 : left > right ? 1 : 0
    })

  if (safeCandidates.length === 0) {
    if (sawMismatch) return { ok: false, reason: 'identity_mismatch' }
    if (sawInsufficient) return { ok: false, reason: 'identity_insufficient' }
    if (sawUnknownMatch) return { ok: false, reason: 'unknown_match' }
    if (sawUnstable) return { ok: false, reason: 'unstable_strategy' }
    return { ok: false, reason: 'no_match' }
  }

  return { ok: true, selector: safeCandidates[0], candidates: safeCandidates }
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
    if (payload.field === 'pair') {
      if (!site.fields.includes('input') || !site.fields.includes('button')) {
        return { status: 'invalid_payload', reason: 'unsupported_field' }
      }
    } else if (!site.fields.includes(payload.field)) {
      return { status: 'invalid_payload', reason: 'unsupported_field' }
    }

    const view = await deps.findViewForSite(site, sites)
    if (!view) return { status: 'site_not_open' }

    const viewHost = normalizeUrlHost(view.url)
    if (!viewHost) return { status: 'verification_failed', reason: 'invalid_view_url' }
    const viewMatch = findSelectorSiteMatch(viewHost, sites, urlPathOf(view.url))
    if (!viewMatch || viewMatch.ambiguous || viewMatch.site.siteId !== site.siteId) {
      return { status: 'verification_failed', reason: 'view_site_mismatch' }
    }

    const isSameDocument = async (): Promise<boolean> => {
      const afterUrl = await deps.getViewUrl(view.viewId).catch(() => null)
      if (!afterUrl || afterUrl !== view.url) return false
      if (view.documentToken && deps.getViewDocumentToken) {
        const afterToken = await deps.getViewDocumentToken(view.viewId).catch(() => null)
        if (!afterToken || afterToken !== view.documentToken) return false
      }
      return true
    }

    const storedHost = viewHost
    const expectedSourceUrl = storedSourceUrl(view.url)

    const verifyOneField = async (
      field: SelectorField,
      bundle: SelectorLocatorBundle,
      composerInput?: {
        selectors: string[]
        fingerprint: AutomationElementFingerprint | null
      } | null
    ): Promise<
      { ok: true; selector: string; candidates: string[] } | { ok: false; reason: string }
    > => {
      const runScript = (probe: boolean): Promise<unknown> =>
        deps.executeScript(
          view.viewId,
          generateVerifyLocatorScript({
            field,
            selectors: bundle.candidates,
            fingerprint: bundle.fingerprint,
            ...(composerInput ? { composerInput } : {}),
            ...(probe ? { probe: true } : {})
          })
        )

      const checkHref = (raw: unknown): { ok: false; reason: string } | null => {
        const resultHref = readResultHref(raw)
        if (
          resultHref &&
          (!expectedSourceUrl || storedSourceUrl(resultHref) !== expectedSourceUrl)
        ) {
          return { ok: false, reason: 'view_navigated' }
        }
        return null
      }

      let rawResult: unknown
      try {
        rawResult = await runScript(false)
      } catch {
        return { ok: false, reason: 'verification_threw' }
      }

      const verified = verifyPick(rawResult, field, bundle)

      // A send button can be absent from the app's view even though Chrome
      // rendered it, because the app's composer is still empty (ChatGPT shows
      // voice mode there). A failed verification — including one where a
      // candidate resolved to a *twin* — gets one probe run on an empty
      // composer. Candidates from the two DOM states are never merged; the
      // probe's attempts go through the same `verifyPick` rules on their own.
      let probed = false
      if (
        !verified.ok &&
        field === 'button' &&
        composerInput &&
        PROBE_ELIGIBLE.has(verified.reason)
      ) {
        // The probe writes into the page, so the document it writes to must be
        // the one that was just verified. A navigation or reload between the two
        // runs would otherwise let the probe type into a fresh page.
        if (!(await isSameDocument())) {
          return { ok: false, reason: 'view_navigated' }
        }
        probed = true
        let probeRaw: unknown = null
        try {
          probeRaw = await runScript(true)
        } catch {
          probeRaw = null
        }
        if (probeRaw) {
          const cleanup = readProbeCleanup(probeRaw)
          if (cleanup && cleanup !== 'not_started' && cleanup !== 'cleared') {
            // The probe may have left its character in the user's composer. The
            // pick itself could still be valid, but a verified save after an
            // unconfirmed write would hide that from the user.
            deps.logVerificationFailure?.(
              summarizePickFailure(
                payload.hostname,
                field,
                bundle,
                'probe_cleanup_failed',
                probeRaw,
                'ran'
              )
            )
            return { ok: false, reason: 'probe_cleanup_failed' }
          }
          const probedPick = verifyPick(probeRaw, field, bundle)
          if (probedPick.ok) {
            const navigation = checkHref(probeRaw)
            if (navigation) return navigation
            return probedPick
          }
          const probeState = readProbeState(probeRaw)
          if (probeState === 'ran') {
            const reason =
              probedPick.reason === 'not_found'
                ? 'button_not_rendered_empty_composer'
                : probedPick.reason
            deps.logVerificationFailure?.(
              summarizePickFailure(payload.hostname, field, bundle, reason, probeRaw, probeState)
            )
            return { ok: false, reason }
          }
          // The composer was not empty, or no composer was found: nothing was
          // written, so the original read-only verdict still stands.
        }
      }

      if (!verified.ok) {
        deps.logVerificationFailure?.(
          summarizePickFailure(
            payload.hostname,
            field,
            bundle,
            verified.reason,
            rawResult,
            probed ? 'skipped' : 'not_requested'
          )
        )
        return verified
      }
      return checkHref(rawResult) ?? verified
    }

    if (payload.field === 'pair') {
      const verifiedInput = await verifyOneField('input', payload.input)
      if (!verifiedInput.ok) {
        return {
          status: 'verification_failed',
          reason: verifiedInput.reason,
          failedField: 'input'
        }
      }

      if (!(await isSameDocument())) {
        return { status: 'verification_failed', reason: 'view_navigated', failedField: 'input' }
      }

      const verifiedButton = await verifyOneField('button', payload.button, {
        selectors: verifiedInput.candidates,
        fingerprint: payload.input.fingerprint
      })
      if (!verifiedButton.ok) {
        return {
          status: 'verification_failed',
          reason: verifiedButton.reason,
          failedField: 'button'
        }
      }

      if (!(await isSameDocument())) {
        return { status: 'verification_failed', reason: 'view_navigated' }
      }

      const configMap = deps.readConfigs ? ((await deps.readConfigs()) as AiConfigMap) : undefined
      const existing = configMap
        ? (resolveConfigForHostname(configMap, storedHost) ?? undefined)
        : undefined

      if (!(await isSameDocument())) {
        return { status: 'verification_failed', reason: 'view_navigated' }
      }

      const patch: AiSelectorConfig = {
        version: 2,
        input: verifiedInput.selector,
        inputCandidates: verifiedInput.candidates,
        inputFingerprint: payload.input.fingerprint,
        button: verifiedButton.selector,
        buttonCandidates: verifiedButton.candidates,
        buttonFingerprint: payload.button.fingerprint,
        sourceUrl: storedSourceUrl(view.url),
        sourceHostname: storedHost,
        canonicalHostname: canonicalizeHostname(storedHost) || storedHost,
        ...locatorHealthPatch(existing, 'pair')
      }

      const saved = await deps.savePatch(storedHost, patch, 'pair')
      if (!saved) return { status: 'save_failed' }

      deps.broadcastConfigChanged(storedHost)
      return { status: 'saved', hostname: storedHost, field: 'pair' }
    }

    const configMapBefore = deps.readConfigs
      ? ((await deps.readConfigs()) as AiConfigMap)
      : undefined
    const existingBefore = configMapBefore
      ? (resolveConfigForHostname(configMapBefore, storedHost) ?? undefined)
      : undefined

    const existingComposerInput =
      payload.field === 'button' && existingBefore
        ? {
            selectors: [
              ...(typeof existingBefore.input === 'string' && existingBefore.input
                ? [existingBefore.input]
                : []),
              ...(Array.isArray(existingBefore.inputCandidates)
                ? existingBefore.inputCandidates
                : [])
            ],
            fingerprint: existingBefore.inputFingerprint ?? null
          }
        : null

    const verified = await verifyOneField(payload.field, payload, existingComposerInput)
    if (!verified.ok) {
      return { status: 'verification_failed', reason: verified.reason }
    }

    if (!(await isSameDocument())) {
      return { status: 'verification_failed', reason: 'view_navigated' }
    }

    const configMap = deps.readConfigs ? ((await deps.readConfigs()) as AiConfigMap) : undefined
    const existing = configMap
      ? (resolveConfigForHostname(configMap, storedHost) ?? undefined)
      : undefined

    if (!(await isSameDocument())) {
      return { status: 'verification_failed', reason: 'view_navigated' }
    }

    // Only the field this pick describes is replaced. The other field's staged
    // repair state, health evidence and candidates stay exactly as they were;
    // otherwise picking the input would silently cure a broken button.
    const fieldPatch: AiSelectorConfig =
      payload.field === 'input'
        ? {
            input: verified.selector,
            inputCandidates: verified.candidates,
            inputFingerprint: payload.fingerprint
          }
        : {
            button: verified.selector,
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

    const saved = await deps.savePatch(storedHost, patch, payload.field)
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
  hostname: string,
  field: SelectorField,
  bundle: SelectorLocatorBundle,
  reason: string,
  raw: unknown,
  probeState?: string
): SelectorPickFailure {
  const result = isRecord(raw) ? (raw as VerificationResult) : {}
  const has = (value: unknown): value is string => typeof value === 'string' && value.length > 0
  const attempts = verificationAttempts(result)
  // Only structural attributes: never text, aria-label, placeholder or class
  // tokens, which can carry page or prompt content.
  const descriptor = attempts[0]?.descriptor
  const fingerprintTag = has(bundle.fingerprint.tag) ? bundle.fingerprint.tag : ''
  const descriptorTag = isRecord(descriptor) && has(descriptor.tag) ? descriptor.tag : ''
  return {
    hostname,
    field,
    reason,
    tag: bundle.fingerprint.tag,
    identity: {
      role: has(bundle.fingerprint.role),
      type: has(bundle.fingerprint.type),
      dataTestId: has(bundle.fingerprint.dataTestId),
      id: has(bundle.fingerprint.safeId),
      name: has(bundle.fingerprint.name),
      ariaLabel: has(bundle.fingerprint.ariaLabel),
      placeholder: has(bundle.fingerprint.placeholder),
      text: has(bundle.fingerprint.text),
      contentEditable: bundle.fingerprint.contentEditable === true
    },
    verifier: {
      matched: typeof result.matchedSelector === 'string' && result.matchedSelector.length > 0,
      matchedInCandidates:
        typeof result.matchedSelector === 'string' &&
        bundle.candidates.includes(result.matchedSelector.trim()),
      strategy: typeof result.strategy === 'string' ? result.strategy : null,
      attempts: attempts.length,
      ambiguous: result.diagnostics?.[field]?.ambiguous === true,
      probe: probeState ?? null,
      cleanup: readProbeCleanup(raw),
      ...(descriptor
        ? {
            descriptor: {
              tag: has(descriptorTag) ? descriptorTag : null,
              type: isRecord(descriptor) && has(descriptor.type) ? String(descriptor.type) : null,
              role: isRecord(descriptor) && has(descriptor.role) ? String(descriptor.role) : null,
              contentEditable: isRecord(descriptor) && descriptor.contentEditable === true,
              dataTestId: isRecord(descriptor) && has(descriptor.dataTestId),
              id: isRecord(descriptor) && has(descriptor.id),
              name: isRecord(descriptor) && has(descriptor.name),
              tagAgrees: Boolean(
                fingerprintTag && descriptorTag && fingerprintTag === descriptorTag
              )
            }
          }
        : {})
    }
  }
}
