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
  options: {
    result?: unknown
    view?: { viewId: string; url: string } | null
    viewAfter?: string | null
    configs?: Record<string, Record<string, unknown>>
    sites?: SelectorSiteTarget[]
  } = {}
) {
  const savePatch = vi.fn(
    async (_hostname: string, _patch: Record<string, unknown>, _field?: string) => true
  )
  const broadcastConfigChanged = vi.fn()
  const executeScript = vi.fn(async (_viewId: string, script: string) =>
    typeof options.result === 'function'
      ? (options.result as (script: string) => unknown)(script)
      : 'result' in options
        ? options.result
        : verified()
  )
  const findViewForSite = vi.fn(async () => options.view ?? null)
  const getViewUrl = vi.fn(async (viewId: string) =>
    'viewAfter' in options
      ? (options.viewAfter ?? null)
      : (options.view ?? { viewId, url: OPEN_VIEW.url }).url
  )
  const ingest = createSelectorIngest({
    loadSites: async () => options.sites ?? [CHATGPT, CLAUDE],
    readConfigs: async () => options.configs ?? {},
    savePatch,
    findViewForSite,
    executeScript,
    getViewUrl,
    broadcastConfigChanged
  })
  return { ingest, savePatch, broadcastConfigChanged, executeScript, findViewForSite, getViewUrl }
}

const OPEN_VIEW = { viewId: 'tab-1', url: 'https://chatgpt.com/' }

function depsIngest(ingest: ReturnType<typeof createSelectorIngest>) {
  return ingest(payload())
}

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
      inputCandidates: ['#composer'],
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
    // the one the app can resolve, not the one that only worked in Chrome, and
    // it comes first so the runtime does not prefer the unverified one.
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({ matchedSelector: 'textarea[data-testid="prompt"]' })
    })
    const result = await deps.ingest(payload())

    expect(result.status).toBe('saved')
    const [, patch] = deps.savePatch.mock.calls[0]
    expect(patch).toMatchObject({
      input: 'textarea[data-testid="prompt"]',
      inputCandidates: ['textarea[data-testid="prompt"]']
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
      reason: 'identity_insufficient'
    })
  })

  it('refuses a tag-only match as insufficient identity evidence', async () => {
    // The fingerprint has no attribute that can distinguish the element from a
    // twin, so agreeing on <button> is not proof that this is the pick.
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button',
        descriptor: { tag: 'button' }
      })
    })
    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'button',
        candidates: ['button'],
        fingerprint: { tag: 'button' }
      })
    )
    expect(result).toEqual({ status: 'verification_failed', reason: 'identity_insufficient' })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('refuses a stable identity contradiction', async () => {
    // The pick says data-testid=send; the app's element has data-testid=voice.
    // A missing attribute is missing evidence, but a different one is a
    // contradiction and must reject even if another field happens to agree.
    const logVerificationFailure = vi.fn()
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button[data-testid="voice"]',
        descriptor: {
          tag: 'button',
          dataTestId: 'voice',
          type: 'submit',
          text: 'Send'
        }
      })
    })
    const ingest = createSelectorIngest({
      loadSites: async () => [CHATGPT, CLAUDE],
      readConfigs: async () => ({}),
      savePatch: vi.fn(async () => true),
      findViewForSite: async () => OPEN_VIEW,
      executeScript: async () =>
        verified({
          field: 'button',
          matchedSelector: 'button[data-testid="voice"]',
          descriptor: {
            tag: 'button',
            dataTestId: 'voice',
            type: 'submit',
            text: 'Send'
          }
        }),
      getViewUrl: async () => OPEN_VIEW.url,
      broadcastConfigChanged: vi.fn(),
      logVerificationFailure
    })
    const result = await ingest(
      payload({
        field: 'button',
        selector: 'button[data-testid="send"]',
        candidates: ['button[data-testid="send"]', 'button[data-testid="voice"]'],
        fingerprint: { tag: 'button', dataTestId: 'send', type: 'submit', text: 'Send' }
      })
    )
    expect(result).toEqual({ status: 'verification_failed', reason: 'identity_mismatch' })
    expect(deps.savePatch).not.toHaveBeenCalled()
    const logged = logVerificationFailure.mock.calls[0][0]
    // Debugging identifiers only: the fingerprint values and the verifier's
    // element text never reach the log.
    expect(logged).toMatchObject({
      hostname: 'chatgpt.com',
      field: 'button',
      reason: 'identity_mismatch',
      tag: 'button',
      identity: { dataTestId: true, type: true, text: true }
    })
    expect(JSON.stringify(logged)).not.toContain('Send')
  })

  it('accepts a missing attribute when another identity field agrees', async () => {
    // The app's DOM does not render data-testid on this build, but the same
    // aria-label and text identify the send button. A missing attribute is not
    // a contradiction on its own.
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button[aria-label="Send message"]',
        descriptor: { tag: 'button', ariaLabel: 'Send message', text: 'Send message' }
      })
    })
    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'button[data-testid="send"]',
        candidates: ['button[data-testid="send"]', 'button[aria-label="Send message"]'],
        fingerprint: {
          tag: 'button',
          dataTestId: 'send',
          ariaLabel: 'Send message',
          text: 'Send message'
        }
      })
    )
    expect(result.status).toBe('saved')
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

  it('refuses two candidates that agree but resolved to different elements', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button[data-testid="send"]',
        attempts: [
          {
            selector: 'button[data-testid="send"]',
            matchedSelector: 'button[data-testid="send"]',
            strategy: 'direct',
            elementKey: 1,
            descriptor: { tag: 'button', dataTestId: 'send' }
          },
          {
            selector: 'button',
            matchedSelector: 'button',
            strategy: 'direct',
            elementKey: 2,
            descriptor: { tag: 'button', dataTestId: 'send' }
          }
        ]
      })
    })
    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'button',
        candidates: ['button', 'button[data-testid="send"]'],
        fingerprint: { tag: 'button', dataTestId: 'send' }
      })
    )
    expect(result).toEqual({ status: 'verification_failed', reason: 'ambiguous' })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('accepts two candidates that resolved to the same element', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button',
        attempts: [
          {
            selector: 'button[data-testid="send"]',
            matchedSelector: 'button[data-testid="send"]',
            strategy: 'direct',
            elementKey: 7,
            descriptor: { tag: 'button', dataTestId: 'send' }
          },
          {
            selector: 'button',
            matchedSelector: 'button',
            strategy: 'direct',
            elementKey: 7,
            descriptor: { tag: 'button', dataTestId: 'send' }
          }
        ]
      })
    })
    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'button',
        candidates: ['button', 'button[data-testid="send"]'],
        fingerprint: { tag: 'button', dataTestId: 'send' }
      })
    )
    expect(result.status).toBe('saved')
    const [, patch] = deps.savePatch.mock.calls[0]
    expect(patch).toMatchObject({
      button: 'button[data-testid="send"]',
      buttonCandidates: ['button[data-testid="send"]', 'button']
    })
  })

  it('reports a store failure instead of claiming success', async () => {
    const deps = createIngest({ view: OPEN_VIEW })
    deps.savePatch.mockResolvedValueOnce(false)
    await expect(deps.ingest(payload())).resolves.toEqual({ status: 'save_failed' })
    expect(deps.broadcastConfigChanged).not.toHaveBeenCalled()
  })

  it('refuses a pick whose site id no longer matches the hostname', async () => {
    const deps = createIngest({ view: OPEN_VIEW })
    await expect(deps.ingest(payload({ siteId: 'claude' }))).resolves.toEqual({
      status: 'invalid_payload',
      reason: 'site_id_mismatch'
    })
    expect(deps.executeScript).not.toHaveBeenCalled()
  })

  it('refuses a hostname that belongs to two sites', async () => {
    const base: Omit<SelectorSiteTarget, 'siteId' | 'displayName'> = {
      hostname: 'shared.example',
      hosts: ['shared.example'],
      fields: ['input', 'button'],
      canonicalHostname: 'example'
    }
    const deps = createIngest({
      view: { viewId: 'tab-1', url: 'https://shared.example/' },
      sites: [
        { ...base, siteId: 'site-a', displayName: 'A' },
        { ...base, siteId: 'site-b', displayName: 'B' }
      ]
    })
    const result = await deps.ingest(
      payload({
        hostname: 'shared.example',
        sourceUrl: 'https://shared.example/'
      })
    )
    expect(result).toEqual({ status: 'ambiguous_site' })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('does not store a result whose view navigated during verification', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      viewAfter: 'https://chatgpt.com/c/another-conversation'
    })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'view_navigated'
    })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('rejects a same-URL reload when the document lifecycle token changes', async () => {
    const savePatch = vi.fn(async () => true)
    const ingest = createSelectorIngest({
      loadSites: async () => [CHATGPT],
      readConfigs: async () => ({}),
      savePatch,
      findViewForSite: async () => ({
        viewId: 'tab-1',
        url: 'https://chatgpt.com/',
        documentToken: '1:1'
      }),
      executeScript: async () => verified({ href: 'https://chatgpt.com/' }),
      getViewUrl: async () => 'https://chatgpt.com/',
      getViewDocumentToken: async () => '1:2',
      broadcastConfigChanged: vi.fn()
    })
    await expect(depsIngest(ingest)).resolves.toEqual({
      status: 'verification_failed',
      reason: 'view_navigated'
    })
    expect(savePatch).not.toHaveBeenCalled()
  })

  it('rejects when verifier href path differs from the view path (SPA route change)', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({ href: 'https://chatgpt.com/c/other-chat' })
    })
    await expect(deps.ingest(payload())).resolves.toEqual({
      status: 'verification_failed',
      reason: 'view_navigated'
    })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('rejects when the view closes or is replaced before save', async () => {
    const savePatch = vi.fn(async () => true)
    let calls = 0
    const ingest = createSelectorIngest({
      loadSites: async () => [CHATGPT],
      readConfigs: async () => ({}),
      savePatch,
      findViewForSite: async () => ({
        viewId: 'tab-1',
        url: 'https://chatgpt.com/',
        documentToken: '1:1'
      }),
      executeScript: async () => verified({ href: 'https://chatgpt.com/' }),
      getViewUrl: async () => 'https://chatgpt.com/',
      // First check (after executeScript) passes, second check (before savePatch) sees new view generation.
      getViewDocumentToken: async () => (++calls === 1 ? '1:1' : '2:1'),
      broadcastConfigChanged: vi.fn()
    })
    await expect(depsIngest(ingest)).resolves.toEqual({
      status: 'verification_failed',
      reason: 'view_navigated'
    })
    expect(savePatch).not.toHaveBeenCalled()
  })

  it('saves when the document token and URL remain unchanged', async () => {
    const savePatch = vi.fn(async () => true)
    const ingest = createSelectorIngest({
      loadSites: async () => [CHATGPT],
      readConfigs: async () => ({}),
      savePatch,
      findViewForSite: async () => ({
        viewId: 'tab-1',
        url: 'https://chatgpt.com/',
        documentToken: '3:5'
      }),
      executeScript: async () => verified({ href: 'https://chatgpt.com/' }),
      getViewUrl: async () => 'https://chatgpt.com/',
      getViewDocumentToken: async () => '3:5',
      broadcastConfigChanged: vi.fn()
    })
    await expect(depsIngest(ingest)).resolves.toEqual({
      status: 'saved',
      hostname: 'chatgpt.com',
      field: 'input'
    })
    expect(savePatch).toHaveBeenCalledTimes(1)
  })

  it('keeps the other locator repair state when only the input is picked', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      configs: {
        'chatgpt.com': {
          version: 2,
          input: '#old-input',
          button: '#broken-button',
          health: 'needs_repick',
          repair: {
            button: {
              selector: '#maybe-button',
              strategy: 'candidate',
              confidenceScore: 40,
              confidenceLevel: 'low',
              firstSeenAt: 1,
              lastSeenAt: 2,
              successCount: 1,
              consecutiveSuccessCount: 1
            }
          }
        }
      }
    })

    const result = await deps.ingest(payload())
    expect(result.status).toBe('saved')
    const [, patch] = deps.savePatch.mock.calls[0]
    expect(patch).toMatchObject({
      input: '#composer',
      health: 'needs_repick',
      repair: { button: expect.objectContaining({ selector: '#maybe-button' }) }
    })
    expect(patch).not.toHaveProperty('button')
  })

  it('clears the staged repair of the locator being picked and heals the site', async () => {
    const staged = {
      selector: '#old-input',
      strategy: 'candidate',
      confidenceScore: 80,
      confidenceLevel: 'high',
      firstSeenAt: 1,
      lastSeenAt: 2,
      successCount: 2,
      consecutiveSuccessCount: 2
    }
    const deps = createIngest({
      view: OPEN_VIEW,
      configs: {
        'chatgpt.com': {
          version: 2,
          input: '#old-input',
          button: '#send',
          health: 'needs_repick',
          repair: { input: staged }
        }
      }
    })

    const result = await deps.ingest(payload())
    expect(result.status).toBe('saved')
    const [, patch] = deps.savePatch.mock.calls[0]
    expect(patch).toMatchObject({ input: '#composer', health: 'ready', repair: null })
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

  it('drops unknown fingerprint fields instead of storing them', () => {
    const parsed = parseSelectorTransferPayload(
      payload({
        fingerprint: {
          tag: 'textarea',
          dataTestId: 'prompt',
          pageContent: 'a private prompt',
          classTokens: ['composer', '', 42]
        }
      })
    )
    expect('payload' in parsed).toBe(true)
    if (!('payload' in parsed) || parsed.payload.field === 'pair') return
    expect(parsed.payload.fingerprint).toEqual({
      tag: 'textarea',
      dataTestId: 'prompt',
      classTokens: ['composer']
    })
  })

  it('rejects a site id that is not a bounded string', () => {
    expect(parseSelectorTransferPayload(payload({ siteId: 42 }))).toEqual({
      reason: 'invalid_site_id'
    })
    expect(parseSelectorTransferPayload(payload({ siteId: 'x'.repeat(200) }))).toEqual({
      reason: 'invalid_site_id'
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
      // Only the verified candidate stays stored; unverified and conflicting
      // candidates are dropped so runtime priority cannot pick a twin.
      buttonCandidates: ['button']
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

  it('refuses a wrong button that only shares class tokens and generic type', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button.composer-btn',
        attempts: [
          {
            selector: 'button.composer-btn',
            matchedSelector: 'button.composer-btn',
            strategy: 'direct',
            descriptor: {
              tag: 'button',
              type: 'button',
              classTokens: ['composer-btn', 'icon-btn'],
              ariaLabel: 'Start voice mode',
              text: ''
            }
          }
        ]
      })
    })
    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'button.composer-btn',
        candidates: ['button.composer-btn'],
        fingerprint: {
          tag: 'button',
          type: 'button',
          classTokens: ['composer-btn', 'icon-btn'],
          ariaLabel: 'Send message',
          text: 'Send'
        }
      })
    )
    expect(result).toEqual({ status: 'verification_failed', reason: 'identity_insufficient' })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('refuses a match supported only by generic role without strong or semantic identity', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'div[role="button"]',
        attempts: [
          {
            selector: 'div[role="button"]',
            matchedSelector: 'div[role="button"]',
            strategy: 'direct',
            descriptor: { tag: 'div', role: 'button', ariaLabel: 'Attach file' }
          }
        ]
      })
    })
    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'div[role="button"]',
        candidates: ['div[role="button"]'],
        fingerprint: { tag: 'div', role: 'button', ariaLabel: 'Send' }
      })
    )
    expect(result).toEqual({ status: 'verification_failed', reason: 'identity_insufficient' })
  })

  it('accepts a localized element when stable id or data-testid agrees', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button[data-testid="send-button"]',
        attempts: [
          {
            selector: 'button[data-testid="send-button"]',
            matchedSelector: 'button[data-testid="send-button"]',
            strategy: 'direct',
            descriptor: {
              tag: 'button',
              dataTestId: 'send-button',
              ariaLabel: 'Send message',
              text: ''
            }
          }
        ]
      })
    })
    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'button[data-testid="send-button"]',
        candidates: ['button[data-testid="send-button"]'],
        fingerprint: {
          tag: 'button',
          dataTestId: 'send-button',
          ariaLabel: 'Mesaj gönder',
          text: 'Gönder'
        }
      })
    )
    expect(result.status).toBe('saved')
  })

  it('drops insufficient and unverified candidates and ignores fallback sourceSelector', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button[aria-label="Send"]',
        attempts: [
          {
            selector: 'button.composer-btn',
            matchedSelector: 'button.composer-btn',
            strategy: 'direct',
            elementKey: 1,
            descriptor: {
              tag: 'button',
              type: 'button',
              classTokens: ['composer-btn'],
              ariaLabel: 'Voice mode'
            }
          },
          {
            selector: '#fallback-trigger',
            matchedSelector: 'button[aria-label="Send"]',
            strategy: 'candidate',
            elementKey: 2,
            descriptor: {
              tag: 'button',
              type: 'button',
              ariaLabel: 'Send'
            }
          }
        ]
      })
    })
    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: '#fallback-trigger',
        candidates: [
          '#fallback-trigger',
          'button.composer-btn',
          '#never-resolved',
          'button[aria-label="Send"]'
        ],
        fingerprint: {
          tag: 'button',
          type: 'button',
          classTokens: ['composer-btn'],
          ariaLabel: 'Send'
        }
      })
    )
    expect(result.status).toBe('saved')
    const [, patch] = deps.savePatch.mock.calls[0]
    expect(patch).toMatchObject({
      button: 'button[aria-label="Send"]',
      buttonCandidates: ['button[aria-label="Send"]']
    })
  })

  it('verifies and saves both input and button atomically for guided pair setup', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      configs: {
        'chatgpt.com': {
          version: 2,
          submitMode: 'enter_key',
          waitFor: '#old-input',
          input: '#old-input',
          button: '#old-button'
        }
      },
      result: (script: string) => {
        if (script.includes("field: 'input'")) {
          return verified({
            field: 'input',
            matchedSelector: '#prompt-textarea',
            attempts: [
              {
                selector: '#prompt-textarea',
                matchedSelector: '#prompt-textarea',
                strategy: 'direct',
                descriptor: { tag: 'div', id: 'prompt-textarea', contentEditable: true }
              }
            ]
          })
        }
        return verified({
          field: 'button',
          matchedSelector: '[data-composer-submit]',
          attempts: [
            {
              selector: '[data-composer-submit]',
              matchedSelector: '[data-composer-submit]',
              strategy: 'direct',
              descriptor: {
                tag: 'button',
                dataComposerSubmit: true,
                ariaLabel: 'Send message'
              }
            }
          ]
        })
      }
    })

    const result = await deps.ingest({
      version: 1,
      requestId: 'request-pair-0123456789',
      hostname: 'chatgpt.com',
      field: 'pair',
      input: {
        selector: '#prompt-textarea',
        candidates: ['#prompt-textarea'],
        fingerprint: { tag: 'div', safeId: 'prompt-textarea', contentEditable: true }
      },
      button: {
        selector: '[data-composer-submit]',
        candidates: ['[data-composer-submit]', 'button[aria-label="Mesaj gönder"]'],
        fingerprint: {
          tag: 'button',
          ariaLabel: 'Mesaj gönder',
          text: 'Gönder'
        }
      },
      sourceUrl: 'https://chatgpt.com/'
    })

    expect(result).toEqual({ status: 'saved', hostname: 'chatgpt.com', field: 'pair' })
    expect(deps.savePatch).toHaveBeenCalledTimes(1)
    const [, patch, field] = deps.savePatch.mock.calls[0]
    expect(field).toBe('pair')
    expect(patch).toMatchObject({
      input: '#prompt-textarea',
      button: '[data-composer-submit]',
      health: 'ready',
      repair: null
    })
  })

  it('leaves existing config untouched when button verification fails during guided pair setup', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: (script: string) => {
        if (script.includes("field: 'input'")) {
          return verified({
            field: 'input',
            matchedSelector: '#prompt-textarea',
            attempts: [
              {
                selector: '#prompt-textarea',
                matchedSelector: '#prompt-textarea',
                strategy: 'direct',
                descriptor: { tag: 'textarea', id: 'prompt-textarea' }
              }
            ]
          })
        }
        return {
          success: false,
          action: 'verify_locator',
          field: 'button',
          attempts: [],
          composerState: 'empty_probe_no_button'
        }
      }
    })

    const result = await deps.ingest({
      version: 1,
      requestId: 'request-pair-fail-012345',
      hostname: 'chatgpt.com',
      field: 'pair',
      input: {
        selector: '#prompt-textarea',
        candidates: ['#prompt-textarea'],
        fingerprint: { tag: 'textarea', safeId: 'prompt-textarea' }
      },
      button: {
        selector: '[data-testid="send-button"]',
        candidates: ['[data-testid="send-button"]'],
        fingerprint: { tag: 'button', dataTestId: 'send-button' }
      },
      sourceUrl: 'https://chatgpt.com/'
    })

    expect(result).toEqual({
      status: 'verification_failed',
      reason: 'button_not_rendered_empty_composer',
      failedField: 'button'
    })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('accepts localized Gemini contenteditable composer via structural + editor class agreement', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'input',
        matchedSelector: 'div[contenteditable="true"][role="textbox"]',
        attempts: [
          {
            selector: 'div[contenteditable="true"][role="textbox"]',
            matchedSelector: 'div[contenteditable="true"][role="textbox"]',
            strategy: 'direct',
            descriptor: {
              tag: 'div',
              role: 'textbox',
              contentEditable: true,
              ariaLabel: 'Enter a prompt here',
              classTokens: ['ql-editor', 'textarea']
            }
          }
        ]
      })
    })

    const result = await deps.ingest(
      payload({
        field: 'input',
        selector: 'div[contenteditable="true"][role="textbox"]',
        candidates: ['div[contenteditable="true"][role="textbox"]', 'div.ql-editor'],
        fingerprint: {
          tag: 'div',
          role: 'textbox',
          contentEditable: true,
          ariaLabel: 'Gemini için bir istem girin',
          classTokens: ['ql-editor']
        }
      })
    )

    expect(result).toEqual({ status: 'saved', hostname: 'chatgpt.com', field: 'input' })
  })

  it('rejects a dictation or voice button even if it shares composer attributes', async () => {
    const deps = createIngest({
      view: OPEN_VIEW,
      result: verified({
        field: 'button',
        matchedSelector: 'button.composer-btn',
        attempts: [
          {
            selector: 'button.composer-btn',
            matchedSelector: 'button.composer-btn',
            strategy: 'direct',
            descriptor: {
              tag: 'button',
              hasDictationAttr: true,
              ariaLabel: 'Dictate button',
              classTokens: ['composer-btn']
            }
          }
        ]
      })
    })

    const result = await deps.ingest(
      payload({
        field: 'button',
        selector: 'button.composer-btn',
        candidates: ['button.composer-btn'],
        fingerprint: {
          tag: 'button',
          ariaLabel: 'Mesaj gönder',
          classTokens: ['composer-btn']
        }
      })
    )

    expect(result).toEqual({ status: 'verification_failed', reason: 'identity_insufficient' })
    expect(deps.savePatch).not.toHaveBeenCalled()
  })

  it('embeds non-destructive empty-composer probing and draft preservation in verifyLocator script', () => {
    const script = generateVerifyLocatorScript({
      field: 'button',
      selectors: ['[data-composer-submit]'],
      fingerprint: { tag: 'button' },
      composerInput: {
        selectors: ['#prompt-textarea'],
        fingerprint: { tag: 'div', safeId: 'prompt-textarea', contentEditable: true }
      }
    })

    expect(script).toContain('writeProbeText')
    expect(script).toContain('existingText.trim().length > 0')
    expect(script).toContain('finally')
    expect(script).toContain('composerState')
    expect(script).not.toContain('waitForElement(')
  })
})
