import { describe, it, expect } from 'vitest'
import { generatePickerScript } from '@electron/features/automation/userElementPicker'

describe('userElementPicker', () => {
    it('includes shadow-aware target resolution helpers', () => {
        const script = generatePickerScript()

        expect(script).toContain('getElementInfo')
        expect(script).toContain('generateRobustSelector')
        expect(script).toContain('_ai_picker_next_btn')
    })
})
