import { describe, expect, it } from 'vitest'

// Kayıtlı prompt'un gövdeye eklendiği yer: text/image/bulk pipeline'larının
// üçünde de aynı yardımcı kullanılır.
import { mergePromptText } from '../../../features/ai/lib/aiSenderSupport'

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
    // Gövde tam olarak iki parçadan oluşur: kayıtlı prompt burada GEÇMEZ, onu
    // pipeline `mergePromptText` ile başa ekler (aşağıdaki test).
    expect(result?.split('\n\n')).toHaveLength(2)
    expect(result).not.toContain('activePromptText')
  })

  it('is deterministic and trims surrounding whitespace', () => {
    const input = { quickActionText: '  Bu içeriği açıkla  ', noteText: '\n odak: mekanizma \n' }
    const first = composeDraftInstruction(input)
    const second = composeDraftInstruction(input)
    expect(first).toBe(second)
    expect(first).toBe('Bu içeriği açıkla\n\nodak: mekanizma')
  })

  /**
   * Üç ayrı veri türü, üç ayrı kaynak, üç ayrı giriş noktası. Gönderim
   * sırasında her talimat **yalnızca bir kez** görünmelidir.
   */
  it('merges quick action, saved prompt and note exactly once each', () => {
    // 1) Hızlı işlem + not → UI tarafında tek bir talimat gövdesi.
    const fromUi = composeDraftInstruction({
      quickActionText: 'Bu içeriği özetle',
      noteText: 'mekanizma üzerinden git'
    })

    // 2) Kayıtlı prompt → pipeline tarafında, gövdenin başına.
    const finalPrompt = mergePromptText('Sınav sorusu üret', fromUi)

    expect(finalPrompt).toBe('Sınav sorusu üret\n\nBu içeriği özetle\n\nmekanizma üzerinden git')
    expect(finalPrompt.match(/özetle/g)).toHaveLength(1)
    expect(finalPrompt.match(/mekanizma/g)).toHaveLength(1)
    expect(finalPrompt.match(/Sınav sorusu/g)).toHaveLength(1)

    // Aynı komut ikinci kez seçilse bile gövde değişmez (toggle yok).
    const again = composeDraftInstruction({
      quickActionText: 'Bu içeriği özetle',
      noteText: 'mekanizma üzerinden git'
    })
    expect(mergePromptText('Sınav sorusu üret', again)).toBe(finalPrompt)
  })
})
