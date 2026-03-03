import { describe, it, expect } from 'vitest'
import { generatePickerScript } from '@electron/features/automation/userElementPicker'

describe('userElementPicker', () => {
    it('includes shadow-aware target resolution helpers', () => {
        const script = generatePickerScript()

        expect(script).toContain('composedPath')
        expect(script).toContain('findDescendantMatch')
        expect(script).toContain('[role="textbox"]')
        expect(script).toContain('[aria-label*="send" i]')
        expect(script).toContain('rich-textarea')
        expect(script).toContain('isGeminiHost')
        expect(script).toContain('[data-ai-picker-ui="1"]')
    })
})
