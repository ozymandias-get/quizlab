import { describe, it, expect } from 'vitest'
import { getStepHtml, getHintHtml } from '@electron/features/automation/utils/uiTemplates'
import type { PickerElementInfo } from '@electron/features/automation/utils/domHelpers'

describe('uiTemplates', () => {

    const mockT = {
        picker_step: 'Step',
        picker_done_btn: 'Done',
        picker_intro_title: 'Title',
        picker_intro_text: 'Text',
        picker_el_input: 'Input Field',
        picker_hint_input_correct: 'Correct Input'
    }

    describe('getStepHtml', () => {
        it('should return HTML for input step', () => {
            const { html, color } = getStepHtml('input', mockT)
            expect(html).toContain('Step 1 / 3')
            expect(html).toContain('Title')
            expect(color).toBe('#60a5fa')
        })

        it('should return HTML for typing step', () => {
            const { html, color } = getStepHtml('typing', mockT)
            expect(html).toContain('Step 2 / 3')
            expect(color).toBe('#f59e0b')
        })

        it('should return HTML for submit step', () => {
            const { html, color } = getStepHtml('submit', mockT)
            expect(html).toContain('Step 3 / 3')
            expect(color).toBe('#4ade80')
        })

        it('should return HTML for done step', () => {
            const { html, color } = getStepHtml('done', mockT)
            expect(html).toContain('Completed!') // defaulting to English if key missing in mockT
            expect(color).toBe('#a78bfa')
        })
    })

    describe('getHintHtml', () => {
        it('should return empty string if no info or irrelevant step', () => {
            expect(getHintHtml('typing', null, mockT)).toBe('')
            expect(getHintHtml('typing', { category: 'input' } as any, mockT)).toBe('')
        })

        it('should return hint for input step', () => {
            const info: PickerElementInfo = {
                category: 'input',
                confidence: 'high',
                labelEN: 'Input',
                tag: 'input',
                labelKey: 'picker_el_input',
                hintKey: 'picker_hint_input_correct'
            }
            const html = getHintHtml('input', info, mockT)
            expect(html).toContain('Input Field')
            expect(html).toContain('Correct Input')
        })

        it('should fallback to EN labels if keys missing', () => {
            const info: PickerElementInfo = {
                category: 'button',
                confidence: 'medium',
                labelEN: 'My Button',
                tag: 'button',
                hintEN: 'Click me'
            }
            const html = getHintHtml('submit', info, {})
            expect(html).toContain('My Button')
            expect(html).toContain('Click me')
        })
    })
})

