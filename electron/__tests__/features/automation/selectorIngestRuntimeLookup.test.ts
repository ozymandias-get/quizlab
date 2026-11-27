/**
 * What Chrome verified must be what the automation later resolves.
 *
 * Ingest and the AI Sender use the same candidate list, but not the same
 * ordering: the runtime sorts candidates by selector priority before resolving
 * them. A candidate that is only correct with the fingerprint (a generic
 * `button`) therefore loses to a class candidate that uniquely matches a twin
 * (the voice button), even though verification passed the pick. This suite
 * exercises the real generated validation script in a DOM, not the verifier.
 */
import { describe, expect, it, vi } from 'vitest'

import type { SelectorSiteTarget } from '../../../features/ai/selectorTargets.js'

import { generateValidateSelectorsScript } from '../../../features/automation/automationScripts/generators/validate.js'
import { createSelectorIngest } from '../../../features/ai/selectorIngest.js'

const CHATGPT: SelectorSiteTarget = {
  siteId: 'chatgpt',
  displayName: 'ChatGPT',
  hostname: 'chatgpt.com',
  hosts: ['chatgpt.com', 'openai.com'],
  fields: ['input', 'button'],
  canonicalHostname: 'openai.com'
}

const HTML = `
  <textarea data-testid="prompt" placeholder="Ask anything"></textarea>
  <button class="cursor-interaction" type="button" aria-label="Start voice mode"></button>
  <button type="submit" aria-label="Send" >Send</button>
`

function loadDom(): void {
  document.body.innerHTML = HTML
}

async function storedPatch() {
  const savePatch = vi.fn(async (_hostname: string, _patch: Record<string, unknown>) => true)
  const ingest = createSelectorIngest({
    loadSites: async () => [CHATGPT],
    readConfigs: async () => ({}),
    savePatch,
    findViewForSite: async () => ({ viewId: 'tab-1', url: 'https://chatgpt.com/' }),
    executeScript: async () => ({
      success: true,
      action: 'verify_locator',
      field: 'button',
      href: 'https://chatgpt.com/',
      matchedSelector: 'button',
      strategy: 'direct',
      descriptor: { tag: 'button', type: 'submit', ariaLabel: 'Send', text: 'Send' },
      attempts: [
        {
          selector: 'button.cursor-interaction',
          matchedSelector: 'button.cursor-interaction',
          strategy: 'direct',
          descriptor: { tag: 'button', type: 'button', ariaLabel: 'Start voice mode', text: '' }
        },
        {
          selector: 'button',
          matchedSelector: 'button',
          strategy: 'direct',
          descriptor: { tag: 'button', type: 'submit', ariaLabel: 'Send', text: 'Send' }
        }
      ],
      diagnostics: { button: { ambiguous: false } }
    }),
    getViewUrl: async () => 'https://chatgpt.com/',
    broadcastConfigChanged: vi.fn()
  })

  const result = await ingest({
    version: 1,
    requestId: 'runtime-lookup-0123456789',
    hostname: 'chatgpt.com',
    field: 'button',
    selector: 'button',
    candidates: ['button', 'button.cursor-interaction'],
    fingerprint: { tag: 'button', type: 'submit', ariaLabel: 'Send', text: 'Send' },
    sourceUrl: 'https://chatgpt.com/'
  })
  expect(result.status).toBe('saved')
  const [, patch] = savePatch.mock.calls[0]
  return patch as Record<string, unknown>
}

const INPUT = {
  input: 'textarea[data-testid="prompt"]',
  inputCandidates: ['textarea[data-testid="prompt"]'],
  inputFingerprint: { tag: 'textarea', dataTestId: 'prompt', placeholder: 'Ask anything' }
}

describe('stored pick in the real automation lookup', () => {
  it('drops the candidate that resolved to the voice button', async () => {
    const patch = await storedPatch()
    expect(patch.button).toBe('button')
    expect(patch.buttonCandidates).toEqual(['button'])
  })

  it('resolves the stored pick to the send button, not the higher-priority twin', async () => {
    const patch = await storedPatch()
    loadDom()
    const script = generateValidateSelectorsScript({
      version: 2,
      ...INPUT,
      button: patch.button as string,
      buttonCandidates: patch.buttonCandidates as string[],
      buttonFingerprint: patch.buttonFingerprint as never,
      submitMode: 'mixed',
      health: 'ready'
    })

    const result = (await window.eval(script)) as {
      success: boolean
      diagnostics: { button?: { matchedSelector?: string } }
    }
    // jsdom has no layout, so the interactive-ready gate cannot pass; the
    // resolved element is what this regression is about.
    expect(result.diagnostics.button?.matchedSelector).toBe('button')
  })

  it('would pick the voice button if the conflicting candidate stayed stored', async () => {
    const patch = await storedPatch()
    loadDom()
    // The pre-fix storage kept every Chrome candidate. This is the regression
    // the filter prevents: the class candidate outranks `button` and resolves
    // uniquely to the wrong element, without consulting the fingerprint.
    const script = generateValidateSelectorsScript({
      version: 2,
      ...INPUT,
      button: patch.button as string,
      buttonCandidates: ['button', 'button.cursor-interaction'],
      buttonFingerprint: patch.buttonFingerprint as never,
      submitMode: 'mixed',
      health: 'ready'
    })

    const result = (await window.eval(script)) as {
      success: boolean
      diagnostics: { button?: { matchedSelector?: string } }
    }
    // jsdom has no layout, so the interactive-ready gate cannot pass; the
    // resolved element is what this regression is about.
    expect(result.diagnostics.button?.matchedSelector).toBe('button.cursor-interaction')
  })
})
