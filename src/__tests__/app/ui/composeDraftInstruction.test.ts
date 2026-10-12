import { describe, expect, it } from 'vitest'

import { composeDraftInstruction } from '@app/ui/aiSendComposer/composeDraftInstruction'

describe('composeDraftInstruction', () => {
  it('returns undefined when there is neither a quick action nor a note', () => {
    expect(composeDraftInstruction({})).toBeUndefined()
    expect(composeDraftInstruction({ quickActionText: null, noteText: null })).toBeUndefined()
    expect(composeDraftInstruction({ quickActionText: '   ', noteText: '' })).toBeUndefined()
  })

  it('keeps the quick action alone when no note is written', () => {
    expect(composeDraftInstruction({ quickActionText: 'Bu içeriği açıkla' })).toBe(
      'Bu içeriği açıkla'
    )
  })

  it('keeps the note alone when no quick action is selected', () => {
    expect(composeDraftInstruction({ noteText: 'slayta sadık kal' })).toBe('slayta sadık kal')
  })

  it('orders quick action before the extra note, exactly once each', () => {
    const result = composeDraftInstruction({
      quickActionText: 'Bu içeriği özetle',
      noteText: 'Türkçe yaz'
    })
    expect(result).toBe('Bu içeriği özetle\n\nTürkçe yaz')
    // Aynı komut iki kez yazılmaz.
    expect(result?.match(/özetle/g)).toHaveLength(1)
  })

  it('is deterministic and trims surrounding whitespace', () => {
    const input = { quickActionText: '  Bu içeriği açıkla  ', noteText: '\n odak: mekanizma \n' }
    const first = composeDraftInstruction(input)
    const second = composeDraftInstruction(input)
    expect(first).toBe(second)
    expect(first).toBe('Bu içeriği açıkla\n\nodak: mekanizma')
  })

  it('does not duplicate a saved prompt: the pipeline owns that segment', () => {
    // Kayıtlı prompt (`activePromptText`) gönderimde pipeline tarafından
    // mergePromptText ile başa eklenir. UI yalnızca bu iki parçayı kurar;
    // kayıtlı prompt burada geçerse aynı talimat iki kez görünürdü.
    const result = composeDraftInstruction({
      quickActionText: 'Bu içeriği açıkla',
      noteText: 'kısa tut'
    })
    expect(result).not.toContain('activePromptText')
    expect(result?.split('\n\n')).toHaveLength(2)
  })
})
