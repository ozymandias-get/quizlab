import { describe, it, expect } from 'vitest'
import {
    generateAutoSendScript,
    generateClickSendScript,
    generateFocusScript
} from '@electron/features/automation/automationScripts'

describe('automationScripts', () => {
    it('generates auto-send script with robust input resolution', () => {
        const script = generateAutoSendScript(
            { input: '[role="textbox"]', button: 'button[aria-label*="send" i]', submitMode: 'mixed' },
            'hello',
            true
        )

        expect(script).toContain('resolveInputElement')
        expect(script).toContain('resolveSubmitButton')
        expect(script).toContain('input_not_accepted')
    })

    it('generates focus script that resolves inner input controls', () => {
        const script = generateFocusScript({ input: 'rich-textarea' })
        expect(script).toContain('resolveInputElement')
    })

    it('generates click script with button fallback resolution', () => {
        const script = generateClickSendScript({ input: '[role="textbox"]', submitMode: 'mixed' })
        expect(script).toContain('resolveSubmitButton')
    })
})
