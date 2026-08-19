import { generateAutoSendScript } from '@electron/features/automation/automationScripts'
import { buildPickerCleanupBlock } from '@electron/features/automation/pickerScript/cleanup'
import { buildPickerIframesBlock } from '@electron/features/automation/pickerScript/iframes'
import { buildSetInputValueScript } from '@electron/features/automation/scripts/setInputValue'

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

  it('finds inputs inside same-origin iframes via selector search', async () => {
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
    expect(frameDoc.getElementById('in-iframe')).not.toBeNull()
  }, 15000)

  it('setInputValue script: non-CE path dispatches beforeinput, no paste fallback', () => {
    const script = buildSetInputValueScript()
    expect(script).toContain("new InputEvent('beforeinput'")
    expect(script).toContain('dispatchBeforeInput')
    expect(script).toContain('insertTextAtCaret')
    // Large-text synthetic paste exists for contenteditable editors only:
    expect(script).toContain('LARGE_TEXT_THRESHOLD')
    expect(script).toContain('pasteLargeText')
    // The final non-CE (value-setter) branch must dispatch beforeinput and
    // never route through the paste helper.
    const lastBeforeInput = script.lastIndexOf('dispatchBeforeInput(value);')
    expect(lastBeforeInput).toBeGreaterThan(-1)
    expect(script.slice(lastBeforeInput)).not.toContain('pasteLargeText')
  })

  it('picker iframe block: recursive scan, per-doc observers, no undefined helper', () => {
    const block = buildPickerIframesBlock()
    expect(block).toContain('scanDocumentForFrames')
    expect(block).toContain('iframeObservers')
    expect(block).toContain('__aiPickerFrameObserved')
    expect(block).not.toContain('ignoreDomAccessError')

    const cleanup = buildPickerCleanupBlock()
    expect(cleanup).toContain('iframeObservers.length = 0')
    expect(cleanup).toContain('__aiPickerFrameObserved')
  })
})
