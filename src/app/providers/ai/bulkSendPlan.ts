import { decorateTextWithSource } from './pdfSource'
import type { AiDraftItem } from './types'

export interface BulkTextEntry {
  id: string
  text: string
}

export interface BulkImageEntry {
  id: string
  dataUrl?: string
  blobUrl?: string
}

export interface SingleMessagePlan {
  /** Sıralı gövde parçaları (metinler + görsel başlıkları, draft sırasıyla). */
  orderedParts: string[]
  /** orderedParts'un "\n\n---\n\n" ile birleşimi. */
  combinedBody: string
  texts: BulkTextEntry[]
  images: BulkImageEntry[]
  itemIds: string[]
}

/**
 * Taslaktaki öğelerden tek-mesajlık gönderim gövdesi kurar.
 *
 * - Sıra korunur: metin ve görsel başlıkları draft sırasıyla dizilir.
 * - Her metin "[PDF Kaynağı — Metin — Sayfa X/Y]" başlığı taşır (kaynak varsa).
 * - Her görsel için "[PDF Kaynağı — Görsel — Sayfa X/Y]" satırı gövdeye eklenir;
 *   görselin kendisi ayrı ek olarak gönderilir.
 * - Prompt/not gövdeye dahil DEĞİLDİR; caller `promptText` olarak ayrı geçirir.
 *   Böylece prompt yalnızca bir kez eklenir.
 * - Boş metinler gövdeye katılmaz ama id'leri "tüketildi" sayılmaz.
 */
export function planSingleMessageSend(
  pending: AiDraftItem[],
  _composerNote?: string
): SingleMessagePlan | null {
  const texts: BulkTextEntry[] = []
  const images: BulkImageEntry[] = []
  const orderedParts: string[] = []
  const itemIds: string[] = []

  for (const draft of pending) {
    if (draft.type === 'text') {
      const trimmed = draft.text.trim()
      if (!trimmed) continue
      const decorated = decorateTextWithSource(trimmed, draft.source ?? null, 'text')
      texts.push({ id: draft.id, text: decorated })
      orderedParts.push(decorated)
      itemIds.push(draft.id)
    } else {
      const dataUrl = draft.dataUrl
      const blobUrl = draft.blobUrl
      if (!dataUrl && !blobUrl) continue
      images.push({ id: draft.id, dataUrl, blobUrl })
      // Görsel başlığı gövdeye metin olarak eklenir (AI tarafında ilişki kurulsun).
      const header = decorateTextWithSource('', draft.source ?? null, 'image')
      // decorateTextWithSource('', source) başlığı döndürür; kaynaksızsa boş döner.
      if (header) {
        orderedParts.push(header)
      }
      itemIds.push(draft.id)
    }
  }

  if (itemIds.length === 0) return null

  const combinedBody = orderedParts.join('\n\n---\n\n')
  return { orderedParts, combinedBody, texts, images, itemIds }
}

/**
 * Sağlayıcının çoklu görseli tek mesajda taşıyıp taşıyamayacağı.
 *
 * api-chat ek dizisini (`attachmentsByTab`) destekler; web içeriklerinde
 * çoklu yapıştırma + tek submit denenir. Bilinmeyen sağlayıcıda iyimser
 * `true` dönülür; başarısızlık sessizce bölünmez — hata olarak raporlanır
 * ve taslak korunur (caller sorumluluğunda).
 */
export function supportsSingleMessageBulk(_providerId: string, imageCount: number): boolean {
  if (imageCount <= 1) return true
  return true
}
