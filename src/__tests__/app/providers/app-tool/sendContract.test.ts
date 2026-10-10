import { describe, expect, it } from 'vitest'

import { resolveAutoSend } from '../../../../features/ai/lib/sendUtils'

/**
 * Gönderim sözleşmesi:
 * | İşlem            | Otomatik açık | Otomatik kapalı |
 * | AI'ye Gönder     | ilet + submit | alana hazırla   |
 * | Taslağa Ekle     | sadece ekle   | sadece ekle     |
 * | Taslaktan Gönder | toplu + submit| toplu, submitsiz|
 *
 * Taslağa Ekle global ayarı değiştirmez; doğrudan gönderim taslağı tüketmez.
 */
describe('send contract (autoSend resolution)', () => {
  it('AIye Gönder + otomatik açık → submit', () => {
    expect(resolveAutoSend(true, {})).toBe(true)
    expect(resolveAutoSend(true, { autoSend: true })).toBe(true)
  })

  it('AIye Gönder + otomatik kapalı → hazırla (submit yok)', () => {
    expect(resolveAutoSend(false, {})).toBe(false)
    expect(resolveAutoSend(false, { autoSend: false })).toBe(false)
  })

  it('per-call autoSend globali ezer ama Taslağa Ekle bunu kullanmaz', () => {
    // Taslağa Ekle yolu sendText/sendImage çağırmaz; burada yalnızca
    // çözümleme kuralı pinlenir: explicit false asla true'ya dönmez.
    expect(resolveAutoSend(true, { autoSend: false })).toBe(false)
    expect(resolveAutoSend(false, { autoSend: true })).toBe(true)
  })

  it('Taslaktan Gönder + otomatik açık → tek submit', () => {
    expect(resolveAutoSend(true, undefined)).toBe(true)
  })

  it('Taslaktan Gönder + otomatik kapalı → submitsiz hazırla', () => {
    expect(resolveAutoSend(false, undefined)).toBe(false)
  })
})
