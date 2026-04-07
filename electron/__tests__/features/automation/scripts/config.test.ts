import { describe, expect, it } from 'vitest'
import { serializeAutomationConfig } from '../../../../features/automation/scripts/config'

describe('serializeAutomationConfig', () => {
  it('deduplicates and trims selectors while preserving first-seen order', () => {
    const serialized = serializeAutomationConfig({
      input: '  #prompt  ',
      inputCandidates: ['#prompt', ' .editor ', '', '  .editor  ', null as never],
      waitFor: ' #prompt ',
      button: 'button.send',
      buttonCandidates: ['button.send', ' button.primary ', '']
    })

    expect(serialized.input.selectors).toEqual(['#prompt', '.editor'])
    expect(serialized.waitFor.selectors).toEqual(['#prompt', '.editor'])
    expect(serialized.button.selectors).toEqual(['button.send', 'button.primary'])
  })

  it('uses candidate fallbacks when primary selectors are missing', () => {
    const serialized = serializeAutomationConfig({
      input: '',
      waitFor: '',
      inputCandidates: ['textarea.composer', 'div[contenteditable="true"]'],
      button: '',
      buttonCandidates: ['button[data-send]', 'button[aria-label*="send" i]']
    })

    expect(serialized.input.selectors).toEqual(['textarea.composer', 'div[contenteditable="true"]'])
    expect(serialized.waitFor.selectors).toEqual([
      'textarea.composer',
      'div[contenteditable="true"]'
    ])
    expect(serialized.button.selectors).toEqual([
      'button[data-send]',
      'button[aria-label*="send" i]'
    ])
  })

  it('normalizes submit mode and keeps health/fingerprint defaults stable', () => {
    const serialized = serializeAutomationConfig({
      input: '#prompt',
      waitFor: '#prompt',
      button: '#send',
      submitMode: 'not-supported' as never
    })

    expect(serialized.submitMode).toBe('mixed')
    expect(serialized.health).toBeNull()
    expect(serialized.input.fingerprint).toBeNull()
    expect(serialized.button.fingerprint).toBeNull()
  })
})
