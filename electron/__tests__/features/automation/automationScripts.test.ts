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

        expect(script).toContain('findElement')
        expect(script).toContain('performSubmit')
        expect(script).toContain('isReadyForInteraction')
    })

    it('generates focus script that resolves inner input controls', () => {
        const script = generateFocusScript({ input: 'rich-textarea' })
        expect(script).toContain('findElement')
    })

    it('generates click script with button fallback resolution', () => {
        const script = generateClickSendScript({ input: '[role="textbox"]', submitMode: 'mixed' })
        expect(script).toContain('performSubmit')
    })
})
