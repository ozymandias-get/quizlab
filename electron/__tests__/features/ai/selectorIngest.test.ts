/**
 * What the app does with a selector that arrived from Chrome.
 *
 * The rules under test are the ones the user relies on: nothing is written
 * before the app resolved the selector in its own view, a selector that finds
 * a different element is refused, and the stored patch keeps the untouched
 * field (the merge is the config store's job, the patch shape is this module's).
 */
import { describe, expect, it, vi } from 'vitest'

import type { SelectorSiteTarget } from '../../../features/ai/selectorTargets.js'

import { generateVerifyLocatorScript } from '../../../features/automation/automationScripts/generators/verifyLocator.js'
import {
  createSelectorIngest,
  parseSelectorTransferPayload
} from '../../../features/ai/selectorIngest.js'

const CHATGPT: SelectorSiteTarget = {
  siteId: 'chatgpt',
  displayName: 'ChatGPT',
  hostname: 'chatgpt.com',
  hosts: ['chatgpt.com', 'openai.com'],
  fields: ['input', 'button'],
  canonicalHostname: 'openai.com'
}

const CLAUDE: SelectorSiteTarget = {
  siteId: 'claude',
  displayName: 'Claude',
  hostname: 'claude.ai',
  hosts: ['claude.ai'],
  fields: ['input', 'button'],
  canonicalHostname: 'claude.ai'
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    requestId: 'request-0123456789abcdef',
    hostname: 'chatgpt.com',
    field: 'input',
    selector: '#composer',
    candidates: ['#composer', 'textarea[data-testid="prompt"]'],
    fingerprint: { tag: 'textarea', dataTestId: 'prompt' },
    sourceUrl: 'https://chatgpt.com/',
    ...overrides
  }
}

function verified(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    action: 'verify_locator',
    field: 'input',
    matchedSelector: '#composer',
    strategy: 'direct',
    descriptor: { tag: 'textarea', dataTestId: 'prompt' },
    diagnostics: { input: { ambiguous: false } },
    ...overrides
  }
}

function createIngest(
  options: { result?: unknown; view?: { viewId: string; url: string } | null } = {}
) {
  const savePatch = vi.fn(async (_hostname: string, _patch: Record<string, unknown>) => true)
  const broadcastConfigChanged = vi.fn()
  const executeScript = vi.fn(async () => ('result' in options ? options.result : verified()))
  const findViewForSite = vi.fn(async () => options.view ?? null)
  const ingest = createSelectorIngest({
    loadSites: async () => [CHATGPT, CLAUDE],
    readConfigs: async () => ({}),
    savePatch,
    findViewForSite,
    executeScript,
    broadcastConfigChanged
  })
  return { ingest, savePatch, broadcastConfigChanged, executeScript, findViewForSite }
}

const OPEN_VIEW = { viewId: 'tab-1', url: 'https://chatgpt.com/' }

describe('selector ingestion', () => {
  it('stores the verified pick and announces it', async () => {
    const deps = createIngest({ view: OPEN_VIEW })
    const result = await deps.ingest(payload())

    expect(result).toEqual({ status: 'saved', hostname: 'chatgpt.com', field: 'input' })
    expect(deps.savePatch).toHaveBeenCalledTimes(1)
    const [hostname, patch] = deps.savePatch.mock.calls[0]
    expect(hostname).toBe('chatgpt.com')
    expect(patch).toMatchObject({
      version: 2,
      input: '#composer',
      inputCandidates: ['#composer', 'textarea[data-testid="prompt"]'],
      inputFingerprint: { tag: 'textarea', dataTestId: 'prompt' },
      sourceHostname: 'chatgpt.com',
      canonicalHostname: 'chatgpt.com',
      health: 'ready',
      repair: null
    })
    // A single-field pick must not clear the other field.
    expect(patch).not.toHaveProperty('button')
    expect(deps.broadcastConfigChanged).toHaveBeenCalledWith('chatgpt.com')
  })

  it('stores a button pick under the button keys only', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({ field: 'button', matchedSelector: '#composer', strategy: 'candidate' })
    })
    // The verifier is told to look at the button; the fake mirrors its answer.
    const result = await deps.ingest(
      payload({ field: 'button', selector: '#composer', candidates: ['#composer'] })
    )

    expect(result.status).toBe('saved')
    const [, patch] = deps.savePatch.mock.calls[0]
    expect(patch).toHaveProperty('button', '#composer')
    expect(patch).not.toHaveProperty('input')
  })

  it('keeps the old selectors when the site is not open in the app', async () => {
    const deps = createIngest({ view: null })
    await expect(deps.ingest(payload())).resolves.toEqual({ status: 'site_not_open' })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('refuses a selector the runtime found outside the submitted candidates', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({ matchedSelector: '#some-other-input' })
    })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'unknown_match'
    })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('stores the candidate the app resolved when priority differs between the two DOMs', async () => {
    // Chrome called #composer primary; the app's DOM has a duplicate id and the
    // runtime settled on the verified test-id candidate. The stored primary is
    // the one the app can resolve, not the one that only worked in Chrome.
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({ matchedSelector: 'textarea[data-testid="prompt"]' })
    })
    const result = await deps.ingest(payload())

    expect(result.status).toBe('saved')
    const [, patch] = deps.savePatch.mock.calls[0]
    expect(patch).toMatchObject({
      input: 'textarea[data-testid="prompt"]',
      inputCandidates: ['#composer', 'textarea[data-testid="prompt"]']
    })
  })

  it('refuses an ambiguous resolution', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({ diagnostics: { input: { ambiguous: true } } })
    })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'ambiguous'
    })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('refuses a selector the runtime only found through a fingerprint fallback', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({ strategy: 'fingerprint' })
    })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'unstable_strategy'
    })
  })

  it('refuses a selector that resolved to an element with another identity', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({ descriptor: { tag: 'div', dataTestId: 'prompt' } })
    })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'identity_mismatch'
    })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('refuses a result that cannot prove the element identity', async () => {
    const deps = createIngest({ view: OPEN_VIEW, result: verified({ descriptor: null }) })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'identity_mismatch'
    })
  })

  it('refuses a selector that found nothing', async () => {
    const deps = createIngest({ view: OPEN_VIEW, result: { success: false } })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'not_found'
    })
  })

  it('refuses a site the app does not know', async () => {
    const deps = createIngest({ view: OPEN_VIEW })
    await expect(
      deps.ingest(payload({ hostname: 'example.com', sourceUrl: 'https://example.com/' }))
    ).resolves.toEqual({ status: 'unknown_site' })
    expect(deps.findViewForSite).not.toHaveBeenCalled()
  })

  it('refuses a view of a different site', async () => {
    const deps = createIngest({ view: { viewId: 'tab-2', url: 'https://claude.ai/chat' } })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'view_site_mismatch'
    })
    expect(deps.executeScript).not.toHaveBeenCalled()
  })

  it('does not mistake a shared canonical host for a site identity', async () => {
    // A view on a host that merely resembles the site must not validate this
    // pick, even when a buggy caller hands it over.
    const deps = createIngest({ view: { viewId: 'tab-3', url: 'https://evil-openai.com/' } })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'view_site_mismatch'
    })
  })

  it('reports a store failure instead of claiming success', async () => {
    const deps = createIngest({ view: OPEN_VIEW })
    deps.savePatch.mockResolvedValueOnce(false)
    await expect(deps.ingest(payload())).resolves.toEqual({ status: 'save_failed' })
    expect(deps.broadcastConfigChanged).not.toHaveBeenCalled()
  })
})

describe('selector transfer payload validation', () => {
  it('accepts the documented payload', () => {
    const parsed = parseSelectorTransferPayload(payload())
    expect('payload' in parsed).toBe(true)
  })

  it('rejects an unknown version', () => {
    expect(parseSelectorTransferPayload(payload({ version: 2 }))).toEqual({
      reason: 'unsupported_version'
    })
  })

  it('rejects a request id that is too short to be one', () => {
    expect(parseSelectorTransferPayload(payload({ requestId: 'x' }))).toEqual({
      reason: 'invalid_request_id'
    })
  })

  it('rejects a primary selector that is not in the candidates', () => {
    expect(parseSelectorTransferPayload(payload({ selector: '#other' }))).toEqual({
      reason: 'primary_not_in_candidates'
    })
  })

  it('rejects a selector that smuggles code', () => {
    expect(parseSelectorTransferPayload(payload({ selector: 'a{}', candidates: ['a{}'] }))).toEqual(
      {
        reason: 'invalid_selector'
      }
    )
  })

  it('rejects a source url whose host is not the picked host', () => {
    expect(parseSelectorTransferPayload(payload({ sourceUrl: 'https://claude.ai/' }))).toEqual({
      reason: 'hostname_url_mismatch'
    })
  })

  it('rejects a non-https source url', () => {
    expect(parseSelectorTransferPayload(payload({ sourceUrl: 'http://chatgpt.com/' }))).toEqual({
      reason: 'invalid_url'
    })
  })

  it('rejects a fingerprint without a tag', () => {
    expect(parseSelectorTransferPayload(payload({ fingerprint: { role: 'textbox' } }))).toEqual({
      reason: 'missing_fingerprint_tag'
    })
  })
})

describe('the verification script', () => {
  it('resolves every candidate instead of stopping at the first match', () => {
    // ChatGPT's send and voice buttons share the composer class list. A script
    // that stopped at the first resolved candidate reported the voice button
    // and the pick was refused as an identity mismatch.
    const script = generateVerifyLocatorScript({
      field: 'button',
      selectors: ['button[type="submit"]', 'button.cursor-interaction', 'button'],
      fingerprint: { tag: 'button', type: 'submit' }
    })

    expect(script).toContain('findUniqueSelectorMatch(selector, fingerprint)')
    expect(script).toContain('attempts.push')
    expect(script).not.toContain('waitForElement(')
    // Every candidate has to reach the caller, not only the first one.
    expect(script).toContain('["button[type=\\"submit\\"]","button.cursor-interaction","button"]')
  })

  it('does not wait for a picked button to become enabled', () => {
    // An empty composer keeps its send button disabled. Waiting for it to be
    // interactive here rejected every button pick on those sites, even though
    // the submit phase waits for it to become ready after the text is written.
    const script = generateVerifyLocatorScript({
      field: 'button',
      selectors: ['button[type="submit"]'],
      fingerprint: { tag: 'button' }
    })

    expect(script).not.toContain('waitForElement(')
  })
})

describe('candidate selection', () => {
  it('stores the candidate whose element matches the pick, not the first one', async () => {
    // The class candidate resolves the voice button in the app DOM; the generic
    // button candidate resolves the send button. The fingerprint decides.
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button.cursor-interaction',
        strategy: 'direct',
        descriptor: { tag: 'button', type: 'button' },
        attempts: [
          {
            selector: 'button.cursor-interaction',
            matchedSelector: 'button.cursor-interaction',
            strategy: 'direct',
            descriptor: {
              tag: 'button',
              type: 'button',
              ariaLabel: 'Sesli iletişimi başlat',
              text: ''
            }
          },
          {
            selector: 'button',
            matchedSelector: 'button',
            strategy: 'direct',
            descriptor: { tag: 'button', type: 'submit', ariaLabel: 'Gönder', text: 'Gönder' }
          }
        ]
      })
    })

    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'button[type="submit"]',
        candidates: ['button[type="submit"]', 'button.cursor-interaction', 'button'],
        fingerprint: { tag: 'button', type: 'submit', ariaLabel: 'Gönder', text: 'Gönder' }
      })
    )

    expect(result).toEqual({ status: 'saved', hostname: 'chatgpt.com', field: 'button' })
    const [, patch] = deps.savePatch.mock.calls[0]
    expect(patch).toMatchObject({
      button: 'button',
      buttonCandidates: ['button[type="submit"]', 'button.cursor-interaction', 'button']
    })
  })

  it('treats an attribute the app DOM does not expose as missing evidence', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        descriptor: { tag: 'textarea', dataTestId: 'prompt' },
        attempts: [
          {
            matchedSelector: '#composer',
            strategy: 'direct',
            descriptor: { tag: 'textarea', dataTestId: 'prompt' }
          }
        ]
      })
    })

    const result = await deps.ingest(
      payload({
        fingerprint: {
          tag: 'textarea',
          dataTestId: 'prompt',
          type: 'submit',
          ariaLabel: 'Gönder'
        }
      })
    )

    expect(result.status).toBe('saved')
  })
})
