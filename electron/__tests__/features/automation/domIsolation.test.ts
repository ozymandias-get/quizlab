import { generateAutoSendScript } from '@electron/features/automation/automationScripts'

import { beforeEach, describe, expect, it } from 'vitest'

describe('automation DOM isolation regressions', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete (window as typeof window & { __quizlabReaderAutomationCache?: unknown })
      .__quizlabReaderAutomationCache
  })

  it('contenteditable fallback inserts text exactly once (no paste double-insert)', async () => {
    document.body.innerHTML = '<div id="ce-input" contenteditable="true"></div>'

    const script = generateAutoSendScript(
      { input: '#ce-input', button: '#ce-send', submitMode: 'click' },
      'hello',
      false
    )
    const result = await window.eval(script)

    expect(result.success).toBe(true)
    const editor = document.getElementById('ce-input') as HTMLDivElement
    expect(editor.textContent).toBe('hello')
  })

  it('appends text to existing contenteditable content once', async () => {
    document.body.innerHTML = '<div id="ce-input" contenteditable="true">first</div>'

    const script = generateAutoSendScript(
      { input: '#ce-input', button: '#ce-send', submitMode: 'click' },
      'second',
      false,
      true
    )
    const result = await window.eval(script)

    expect(result.success).toBe(true)
    const editor = document.getElementById('ce-input') as HTMLDivElement
    expect(editor.textContent).toBe('first\n\nsecond')
  })

  it('resolves the composer inside a same-origin iframe and types into it', async () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frameDoc = iframe.contentDocument
    if (!frameDoc) throw new Error('jsdom iframe contentDocument unavailable')
    frameDoc.open()
    frameDoc.write('<html><body><textarea id="in-iframe"></textarea></body></html>')
    frameDoc.close()

    const script = generateAutoSendScript(
      { input: '#in-iframe', button: '#btn-iframe', submitMode: 'click' },
      'hello',
      false
    )
    const result = await window.eval(script)

    expect(result.success).toBe(true)
    // The assertion that carries the meaning: the text landed in the FRAME.
    expect((frameDoc.getElementById('in-iframe') as HTMLTextAreaElement).value).toBe('hello')
  }, 15000)
})
