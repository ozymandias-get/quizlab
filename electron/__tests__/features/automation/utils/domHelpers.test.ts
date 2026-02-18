import { describe, it, expect, beforeEach } from 'vitest'
import { getElementInfo, generateRobustSelector } from '@electron/features/automation/utils/domHelpers'

describe('domHelpers', () => {

    describe('getElementInfo', () => {

        it('should correctly identify text input', () => {
            const el = document.createElement('input')
            el.type = 'text'
            const info = getElementInfo(el as any)
            expect(info.category).toBe('input')
            expect(info.confidence).toBe('high')
        })

        it('should correctly identify submit button', () => {
            const el = document.createElement('input')
            el.type = 'submit'
            const info = getElementInfo(el as any)
            expect(info.category).toBe('button')
            expect(info.confidence).toBe('high')
        })

        it('should correctly identify textarea as input', () => {
            const el = document.createElement('textarea')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('input')
            expect(info.confidence).toBe('high')
        })

        it('should correctly identify button element', () => {
            const el = document.createElement('button')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('button')
            expect(info.confidence).toBe('high')
        })

        it('should correctly identify div with role button', () => {
            const el = document.createElement('div')
            el.setAttribute('role', 'button')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('button')
            expect(info.confidence).toBe('high')
        })

        it('should correctly identify contentEditable div', () => {
            const el = document.createElement('div')
            el.setAttribute('contenteditable', 'true')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('input')
            expect(info.confidence).toBe('high')
        })

        it('should correctly identify clickable div', () => {
            const el = document.createElement('div')
            el.onclick = () => { }
            const info = getElementInfo(el as any)
            expect(info.category).toBe('button')
            expect(info.confidence).toBe('medium')
        })

        it('should correctly identify generic container div', () => {
            const el = document.createElement('div')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('container')
            expect(info.confidence).toBe('low')
        })

        it('should correctly identify icon (svg)', () => {
            const el = document.createElement('svg')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('icon')
            expect(info.confidence).toBe('low')
        })

        it('should correctly identify link (a)', () => {
            const el = document.createElement('a')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('button')
            expect(info.confidence).toBe('medium')
        })

        it('should correctly identify span (text)', () => {
            const el = document.createElement('span')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('text')
            expect(info.confidence).toBe('low')
        })

        it('should correctly identify form', () => {
            const el = document.createElement('form')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('container')
            expect(info.confidence).toBe('low')
        })
    })

    describe('generateRobustSelector', () => {

        beforeEach(() => {
            document.body.innerHTML = ''
        })

        it('should return null if element is null', () => {
            expect(generateRobustSelector(null)).toBeNull()
        })

        it('should generate selector by ID', () => {
            const el = document.createElement('div')
            el.id = 'my-unique-id'
            document.body.appendChild(el)
            expect(generateRobustSelector(el)).toBe('#my-unique-id')
        })

        it('should create #id > something if nested and id present', () => {
            // Placeholder for future tests
        })

        it('should generate selector by data-testid', () => {
            const el = document.createElement('div')
            el.setAttribute('data-testid', 'testing-element')
            document.body.appendChild(el)
            expect(generateRobustSelector(el)).toBe('div[data-testid="testing-element"]')
        })

        it('should generate selector by unique attribute (name)', () => {
            const el = document.createElement('input')
            el.setAttribute('name', 'unique-name')
            document.body.appendChild(el)
            expect(generateRobustSelector(el)).toBe('input[name="unique-name"]')
        })

        it('should generate selector by path if no unique attributes', () => {
            const container = document.createElement('div')
            const span1 = document.createElement('span')
            const span2 = document.createElement('span')

            container.appendChild(span1)
            container.appendChild(span2)
            document.body.appendChild(container)

            const selector = generateRobustSelector(span2)
            // Expect something like body > div:nth-child(1) > span:nth-child(2)
            // The exact output depends on whether body has other children.
            // But we know it contains span:nth-child(2)
            expect(selector).toContain('span:nth-child(2)')
        })

        it('should not use generated or long IDs', () => {
            const el = document.createElement('div')
            el.id = '123456' // Too many digits
            document.body.appendChild(el)
            const selector = generateRobustSelector(el)
            // Should NOT use #123456
            expect(selector).not.toBe('#123456')
            // It will fallback to body > div:nth-child(1) or similar
            expect(selector).toContain('body > div')
        })
    })

    describe('getElementInfo edge cases', () => {
        it('handles inputs with no type attribute', () => {
            const el = document.createElement('input')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('input')
            expect(info.confidence).toBe('high')
        })

        it('handles unknown tags gracefully', () => {
            const el = document.createElement('custom-element')
            const info = getElementInfo(el as any)
            expect(info.category).toBe('unknown')
            expect(info.confidence).toBe('low')
        })
    })
})

