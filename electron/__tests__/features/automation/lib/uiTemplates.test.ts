import { getHintHtml, getStepHtml } from '@electron/features/automation/lib/uiTemplates'
import type { PickerElementInfo } from '@electron/features/automation/lib/domHelpers'
import type { PickerStep } from '@electron/features/automation/lib/uiTemplates'

import { describe, expect, it } from 'vitest'

describe('getStepHtml', () => {
  it('returns HTML and a color for the input step', () => {
    const result = getStepHtml('input')
    expect(result.html).toContain('Select Message Input')
    expect(result.html).toContain('Step 1 / 3')
    expect(result.color).toBe('#60a5fa')
  })

  it('returns HTML and a color for the typing step', () => {
    const result = getStepHtml('typing')
    expect(result.html).toContain('Type a Letter')
    expect(result.html).toContain('Step 2 / 3')
    expect(result.html).toContain('_ai_picker_next_btn')
    expect(result.color).toBe('#f59e0b')
  })

  it('returns HTML and a color for the submit step', () => {
    const result = getStepHtml('submit')
    expect(result.html).toContain('Click Send Button')
    expect(result.html).toContain('Step 3 / 3')
    expect(result.color).toBe('#4ade80')
  })

  it('returns HTML and a color for the done step', () => {
    const result = getStepHtml('done')
    expect(result.html).toContain('Completed!')
    expect(result.html).toContain('Saving settings')
    expect(result.color).toBe('#a78bfa')
  })

  it('uses custom translations when provided', () => {
    const t = {
      picker_step: 'Adım',
      picker_intro_title: 'Mesaj Kutusunu Seç',
      picker_typing_title: 'Harf Yaz',
      picker_done_btn: 'Tamam, Devam'
    }

    const inputResult = getStepHtml('input', t)
    expect(inputResult.html).toContain('Adım')
    expect(inputResult.html).toContain('Mesaj Kutusunu Seç')

    const typingResult = getStepHtml('typing', t)
    expect(typingResult.html).toContain('Harf Yaz')
    expect(typingResult.html).toContain('Tamam, Devam')
  })
})

describe('getHintHtml', () => {
  const baseInputInfo: PickerElementInfo = {
    category: 'input',
    labelEN: 'Message Input',
    labelKey: 'picker_el_input',
    confidence: 'high',
    tag: 'input',
    hintEN: 'This looks like a message input field.',
    hintKey: 'picker_hint_input_correct'
  }

  const baseButtonInfo: PickerElementInfo = {
    category: 'button',
    labelEN: 'Send Button',
    labelKey: 'picker_el_submit',
    confidence: 'high',
    tag: 'button',
    hintEN: 'This is a send button.',
    hintKey: 'picker_hint_submit_correct'
  }

  it('returns empty string when hoveredInfo is null', () => {
    expect(getHintHtml('input', null)).toBe('')
  })

  it('returns empty string when step is not input or submit', () => {
    expect(getHintHtml('typing', baseInputInfo)).toBe('')
    expect(getHintHtml('done', baseInputInfo)).toBe('')
  })

  it('returns hint HTML for a valid input step with input element', () => {
    const html = getHintHtml('input', baseInputInfo)
    expect(html).toContain('Message Input')
    expect(html).toContain('Good Choice')
    expect(html).toContain('message input field')
  })

  it('returns hint HTML for a valid submit step with button element', () => {
    const html = getHintHtml('submit', baseButtonInfo)
    expect(html).toContain('Send Button')
    expect(html).toContain('Good Choice')
    expect(html).toContain('send button')
  })

  it('highlights the confidence color', () => {
    const html = getHintHtml('input', baseInputInfo)
    expect(html).toContain('#4ade80')
  })

  it('shows medium confidence color for unknown category elements', () => {
    const unknownInfo: PickerElementInfo = {
      category: 'unknown',
      labelEN: 'Unknown Element',
      confidence: 'medium',
      tag: 'div'
    }
    const html = getHintHtml('input', unknownInfo)
    expect(html).toContain('#fbbf24')
  })

  it('uses translated strings when available', () => {
    const t = { picker_el_input: 'Mesaj Girişi', picker_good_choice: 'İyi Seçim' }
    const html = getHintHtml('input', baseInputInfo, t)
    expect(html).toContain('Mesaj Girişi')
    expect(html).toContain('İyi Seçim')
  })

  it('falls back to labelEN when translation is not available', () => {
    const html = getHintHtml('input', baseInputInfo, {})
    expect(html).toContain('Message Input')
  })

  it('falls back to hintEN when translation key is missing', () => {
    const info: PickerElementInfo = {
      category: 'input',
      labelEN: 'Input',
      confidence: 'high',
      tag: 'input',
      hintEN: 'Fallback hint'
    }
    const html = getHintHtml('input', info, {})
    expect(html).toContain('Fallback hint')
  })

  it('does not render hint box when both hintEN and hintKey are empty', () => {
    const info: PickerElementInfo = {
      category: 'input',
      labelEN: 'Input',
      confidence: 'high',
      tag: 'input'
    }
    const html = getHintHtml('input', info)
    expect(html).not.toContain('background:rgba')
  })
})
