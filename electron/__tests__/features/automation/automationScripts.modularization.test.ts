import { describe, expect, it } from 'vitest'
import {
  generateAutoSendScript,
  generateFocusScript,
  generateValidateSelectorsScript
} from '@electron/features/automation/automationScripts'

describe('automationScripts modularization', () => {
  it('builds auto-send script with core execution steps', () => {
    const script = generateAutoSendScript(
      { input: '[role="textbox"]', button: 'button[aria-label*="send" i]', submitMode: 'mixed' },
      'hello'
    )

    expect(script).toContain('setInputValue')
    expect(script).toContain('performSubmit')
    expect(script).toContain('createDiagnostics')
  })

  it('keeps common runtime helper injection for facade-generated scripts', () => {
    const focusScript = generateFocusScript({ input: '#input' })
    const validateScript = generateValidateSelectorsScript({
      input: '#input',
      button: '#send',
      submitMode: 'click'
    })

    expect(focusScript).toContain('__quizlabReaderAutomationCache')
    expect(focusScript).toContain('findElementByFingerprint')
    expect(validateScript).toContain("createDiagnostics('validate'")
  })
})
