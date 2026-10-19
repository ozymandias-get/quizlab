import { getHintHtml, getStepHtml } from '@electron/features/automation/lib/uiTemplates'
import type { PickerElementInfo } from '@electron/features/automation/lib/dom/pickerTypes'

import { describe, expect, it } from 'vitest'

/**
 * Bu şablonlar saf metin üreticileridir: girdi (adım + çeviri sözlüğü)
 * çıktıdaki kullanıcı metnini belirler. Testler İngilizce arayüz metnini
 * sabitlemez — bunun yerine adımın DOĞRU olduğunu, çevirinin uygulandığını
 * ve eksik çeviri anahtarlarında İngilizceye düşüldüğünü doğrular, böylece
 * metin değişiklikleri testleri kırmaz.
 */
describe('picker UI templates', () => {
  it('renders each step with its own title and accent colour', () => {
    const steps = [
      { step: 'input', marker: 'Step 1 / 3', color: '#60a5fa' },
      { step: 'typing', marker: 'Step 2 / 3', color: '#f59e0b' },
      { step: 'submit', marker: 'Step 3 / 3', color: '#4ade80' },
      { step: 'done', marker: undefined, color: '#a78bfa' }
    ] as const

    for (const { step, marker, color } of steps) {
      const result = getStepHtml(step)
      expect(result.html, `step ${step} must render HTML`).toBeTypeOf('string')
      expect(result.html.length, `step ${step} must not be empty`).toBeGreaterThan(0)
      expect(result.color, `step ${step} accent colour`).toBe(color)
      if (marker) {
        expect(result.html).toContain(marker)
      }
    }

    // The typing step is the only one offering the "advance" affordance.
    expect(getStepHtml('typing').html).toContain('_ai_picker_next_btn')
    expect(getStepHtml('input').html).not.toContain('_ai_picker_next_btn')
  })

  it('applies custom translations to the step template', () => {
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

  it('renders no hint box when there is nothing to say', () => {
    const info: PickerElementInfo = {
      category: 'input',
      labelEN: 'Message Input',
      labelKey: 'picker_el_input',
      confidence: 'high',
      tag: 'input',
      hintEN: 'This looks like a message input field.',
      hintKey: 'picker_hint_input_correct'
    }

    // No hovered element.
    expect(getHintHtml('input', null)).toBe('')
    // Hints only exist for the input and submit steps.
    expect(getHintHtml('typing', info)).toBe('')
    expect(getHintHtml('done', info)).toBe('')
    // An element with neither hintEN nor hintKey renders no hint box.
    expect(
      getHintHtml('input', {
        category: 'input',
        labelEN: 'Input',
        confidence: 'high',
        tag: 'input'
      })
    ).not.toContain('background:rgba')
  })

  it('renders the element label and colours it by confidence, with translation fallback', () => {
    const inputInfo: PickerElementInfo = {
      category: 'input',
      labelEN: 'Message Input',
      labelKey: 'picker_el_input',
      confidence: 'high',
      tag: 'input',
      hintEN: 'This looks like a message input field.',
      hintKey: 'picker_hint_input_correct'
    }

    // High confidence → green accent; unknown category → amber.
    const inputHtml = getHintHtml('input', inputInfo)
    expect(inputHtml).toContain('Message Input')
    expect(inputHtml).toContain('message input field')
    expect(inputHtml).toContain('#4ade80')

    const mediumHtml = getHintHtml('input', {
      category: 'unknown',
      labelEN: 'Unknown Element',
      confidence: 'medium',
      tag: 'div'
    })
    expect(mediumHtml).toContain('#fbbf24')

    // Translated strings win when present…
    const translated = getHintHtml('input', inputInfo, {
      picker_el_input: 'Mesaj Girişi',
      picker_good_choice: 'İyi Seçim'
    })
    expect(translated).toContain('Mesaj Girişi')
    expect(translated).toContain('İyi Seçim')

    // …and the English defaults are used when a key is missing.
    const fallbackHtml = getHintHtml('input', inputInfo, {})
    expect(fallbackHtml).toContain('Message Input')

    // hintEN is the last-resort source for the hint body.
    const hintFallback = getHintHtml(
      'input',
      {
        category: 'input',
        labelEN: 'Input',
        confidence: 'high',
        tag: 'input',
        hintEN: 'Fallback hint'
      },
      {}
    )
    expect(hintFallback).toContain('Fallback hint')

    // The submit step renders the same shape for a button element.
    const submitHtml = getHintHtml('submit', {
      category: 'button',
      labelEN: 'Send Button',
      labelKey: 'picker_el_submit',
      confidence: 'high',
      tag: 'button',
      hintEN: 'This is a send button.',
      hintKey: 'picker_hint_submit_correct'
    })
    expect(submitHtml).toContain('Send Button')
    expect(submitHtml).toContain('send button')
  })
})
