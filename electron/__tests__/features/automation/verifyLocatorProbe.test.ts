/**
 * The empty-composer probe writes into a live user composer, so its safety is
 * proven on a real DOM instead of by string inspection.
 *
 * Each test loads the generated probe script into a jsdom page that behaves
 * like ChatGPT's composer: the send button only exists while the composer has
 * text. The originals under test are the probe's own rules — write one
 * character, observe, then remove only what it can prove it wrote.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { generateVerifyLocatorScript } from '../../../features/automation/automationScripts/generators/verifyLocator.js'

interface ProbeResult {
  success: boolean
  action: string
  field: string
  attempts: Array<{ selector: string; descriptor: { tag: string } }>
  composerState: string
  probe?: string
  cleanup?: string
}

function buildPage(options: { initialText?: string; controls?: 'button-on-text' | 'none' } = {}) {
  document.body.innerHTML = ''
  const shell = document.createElement('div')
  const composer = document.createElement('div')
  composer.id = 'prompt-textarea'
  composer.setAttribute('contenteditable', 'true')
  composer.setAttribute('role', 'textbox')
  composer.setAttribute('aria-label', 'Ask anything')
  // ProseMirror keeps an empty paragraph; an inner <p> is what a real click on
  // the text targets (and the reason the picker must resolve the editing host).
  composer.innerHTML = '<p><br></p>'
  if (options.initialText) composer.textContent = options.initialText
  const controls = document.createElement('div')
  shell.append(composer, controls)
  document.body.append(shell)

  if (options.controls !== 'none') {
    const sync = () => {
      const text = composer.textContent || ''
      const existing = controls.querySelector('[data-testid="send"]')
      if (text.length > 0 && !existing) {
        const button = document.createElement('button')
        button.setAttribute('data-testid', 'send')
        button.setAttribute('type', 'submit')
        button.setAttribute('aria-label', 'Send')
        controls.append(button)
      } else if (text.length === 0 && existing) {
        existing.remove()
      }
    }
    sync()
    new MutationObserver(sync).observe(composer, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }

  return { composer, controls }
}

function runProbeScript(): Promise<ProbeResult> {
  const script = generateVerifyLocatorScript({
    field: 'button',
    selectors: ['[data-testid="send"]', 'button[type="submit"]'],
    fingerprint: { tag: 'button', type: 'submit' },
    composerInput: {
      selectors: ['#prompt-textarea'],
      fingerprint: { tag: 'div', contentEditable: true, role: 'textbox' }
    },
    probe: true
  })
  // The generated script is an async IIFE; indirect eval hands back its promise.
  return (0, eval)(script) as Promise<ProbeResult>
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the empty-composer probe', () => {
  it('writes one character on an empty composer, finds the button and cleans up', async () => {
    buildPage()

    const result = await runProbeScript()

    expect(result.action).toBe('probe_composer')
    expect(result.probe).toBe('ran')
    expect(result.cleanup).toBe('cleared')
    expect(result.composerState).toBe('empty_probed')
    expect(result.attempts.length).toBeGreaterThan(0)
    // The probe character is gone again; nothing was submitted.
    expect(document.getElementById('prompt-textarea')?.textContent).toBe('')
    expect(document.querySelector('[data-testid="send"]')).toBeNull()
  })

  it('never touches an existing draft', async () => {
    const { composer } = buildPage({ initialText: 'yarım kalan mesaj' })

    const result = await runProbeScript()

    expect(result.probe).toBe('not_run')
    expect(result.composerState).toBe('non_empty')
    expect(composer.textContent).toBe('yarım kalan mesaj')
  })

  it('treats a whitespace-only draft as content and preserves it', async () => {
    const { composer } = buildPage({ initialText: '   ' })

    const result = await runProbeScript()

    expect(result.probe).toBe('not_run')
    expect(composer.textContent).toBe('   ')
  })

  it('leaves the composer alone when the user starts typing during the probe', async () => {
    const { composer } = buildPage()
    let typed = false
    new MutationObserver(() => {
      if (typed) return
      if (composer.textContent === '.') {
        typed = true
        composer.textContent = '.x'
      }
    }).observe(composer, { childList: true, subtree: true, characterData: true })

    const result = await runProbeScript()

    expect(result.probe).toBe('ran')
    expect(result.cleanup).toBe('content_changed')
    // The ownership check refuses to clear '.x': the probe only removes its own
    // character from a composer that still holds exactly that character.
    expect(composer.textContent).toBe('.x')
  })

  it('treats any input event from the user as an edit, even when the text still matches', async () => {
    // A key that leaves the text matching the probe (Enter in a contenteditable
    // adds structure that text normalisation hides) is still a user edit.
    const { composer } = buildPage()
    window.setTimeout(() => {
      if (composer.textContent !== '.') return
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
    }, 400)

    const result = await runProbeScript()

    expect(result.probe).toBe('ran')
    expect(result.cleanup).toBe('left_external_edit')
    expect(composer.textContent).toBe('.')
  })

  it('does not verify a button that disappeared before the observation ended', async () => {
    buildPage()
    window.setTimeout(() => {
      document.querySelector('[data-testid="send"]')?.remove()
    }, 500)

    const result = await runProbeScript()

    expect(result.probe).toBe('ran')
    expect(result.attempts).toEqual([])
    expect(result.composerState).toBe('empty_probe_no_button')
    expect(result.cleanup).toBe('cleared')
    expect(document.getElementById('prompt-textarea')?.textContent).toBe('')
  })

  it('does not clear a composer that was replaced during the probe', async () => {
    const { composer } = buildPage()
    let replaced = false
    new MutationObserver(() => {
      if (replaced) return
      if (composer.textContent === '.') {
        replaced = true
        const replacement = composer.cloneNode(false) as HTMLElement
        replacement.id = 'prompt-textarea'
        replacement.textContent = 'kullanıcı taslağı'
        composer.replaceWith(replacement)
      }
    }).observe(composer, { childList: true, subtree: true, characterData: true })

    const result = await runProbeScript()

    expect(result.probe).toBe('ran')
    expect(result.cleanup).toBe('element_replaced')
    // The detached original is gone; the new composer was never written to or
    // cleared by the probe, even though it now holds text.
    expect(document.getElementById('prompt-textarea')?.textContent).toBe('kullanıcı taslağı')
  })
})
