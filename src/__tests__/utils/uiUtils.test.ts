import { describe, it, expect } from 'vitest'
import { formatQuizText, generateId, hexToRgba } from '@src/utils/uiUtils'

describe('uiUtils', () => {
    describe('formatQuizText', () => {
        it('converts markdown bold to HTML strong tags', () => {
            const input = 'Hello **World**'
            const output = formatQuizText(input)
            expect(output).toBe('Hello <strong>World</strong>')
        })

        it('converts markdown italic to HTML em tags', () => {
            const input = 'Hello *World*'
            const output = formatQuizText(input)
            expect(output).toBe('Hello <em>World</em>')
        })

        it('converts newlines to br tags', () => {
            const input = 'Line 1\nLine 2'
            const output = formatQuizText(input)
            expect(output).toBe('Line 1<br>Line 2')
        })

        it('sanitizes unsafe HTML', () => {
            const input = '<script>alert("xss")</script>Test'
            const output = formatQuizText(input)
            expect(output).not.toContain('<script>')
            expect(output).toContain('Test')
        })
    })

    describe('generateId', () => {
        it('returns a string', () => {
            const id = generateId()
            expect(typeof id).toBe('string')
            expect(id.length).toBeGreaterThan(0)
        })

        it('returns unique IDs', () => {
            const id1 = generateId()
            const id2 = generateId()
            expect(id1).not.toBe(id2)
        })
    })

    describe('hexToRgba', () => {
        it('converts 6-digit hex to rgba', () => {
            expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
            expect(hexToRgba('00ff00', 1)).toBe('rgba(0, 255, 0, 1)')
        })

        it('converts 3-digit hex to rgba', () => {
            expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)')
        })

        it('handles default alpha', () => {
            expect(hexToRgba('#0000ff')).toBe('rgba(0, 0, 255, 1)')
        })

        it('handles empty input', () => {
            expect(hexToRgba('')).toBe('rgba(0, 0, 0, 1)')
        })
    })
})
