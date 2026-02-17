import { describe, it, expect } from 'vitest'
import { pickerStyles } from '../../../utils/automation/styles'

describe('pickerStyles', () => {
    it('should be a string containing CSS rules', () => {
        expect(typeof pickerStyles).toBe('string')
        expect(pickerStyles).toContain('._ai-picker-hover-good')
        expect(pickerStyles).toContain('._ai-picker-hover-medium')
        expect(pickerStyles).toContain('._ai-picker-hover-low')
        expect(pickerStyles).toContain('._ai-picker-selected')
    })

    it('should not be empty', () => {
        expect(pickerStyles.length).toBeGreaterThan(0)
    })
})
