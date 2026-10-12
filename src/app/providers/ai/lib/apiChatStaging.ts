/**
 * api-chat hazırlama telafisi.
 *
 * api-chat yolu, gönderimi kendi deposu üzerinden yapar: içerik önce sekmenin
 * giriş kutusuna ve eklenti listesine **yazılır**, ardından istek atılır.
 * Yazma ile istek arasındaki herhangi bir hatada (görsel hazırlanamadı, ağ
 * hatası, zaman aşımı) yazılan içerik yerinde kalır ve kullanıcı "Tekrar
 * gönder" dediğinde aynı görseller ikinci kez eklenir — kullanıcının istediği
 * tek mesaj, sessizce iki mesaja dönüşür.
 *
 * Bu modül, hazırlama ile teslim arasındaki farkı **açıkça kaydeder** ve
 * teslim gerçekleşmediğinde yalnızca bu katmanın eklediği parçaları geri alır.
 *
 * ## Telafinin sınırı
 *
 * Geri alma **kendi eklediğimiz ve hâlâ yerinde duran** içeriği hedefler:
 *
 * - Girdi: eklediğimiz blok hâlâ sonundaysa kesilir; kullanıcı araya yazdıysa
 *   metne hiç dokunulmaz (kullanıcının verisi telafiye feda edilmez).
 * - Ekler: yalnızca hâlâ sonda duran ve bizim eklediğimiz kaynaklar düşürülür.
 *
 * Belirsiz bir teslim durumunda (`uncertain`) geri alma **yapılmaz**: mesaj
 * gerçekten iletilmiş olabilir, geri almak ikinci bir kopya üretirdi.
 */

/** Eklenen metnin girdiye yapıştırıldığı ayırıcı. */
const API_CHAT_INPUT_SEPARATOR = '\n'

/**
 * Bu modülün ihtiyaç duyduğu depo yüzeyi.
 *
 * Tüm `ChatUiStore` değil, yalnızca yazma/geri alma için gereken alanlar:
 * yardımcı ne okuyor ne de değiştiriyorsa sözleşmeye girmemeli. Gerçek
 * zustand deposu bu portu yapısal olarak karşılar.
 */
interface ApiChatStagingPort {
  inputValueByTab: Record<string, string>
  attachmentsByTab: Record<string, string[]>
  updateInput: (tabId: string, value: string) => void
  addAttachment: (tabId: string, data: string) => void
  removeAttachment: (tabId: string, index: number) => void
}

export type ChatUiStateReader = () => ApiChatStagingPort

/**
 * Bir gönderim hazırlığının geri alınabilir kaydı.
 *
 * `baseInput`, eklemeden **önce** kutuda ne olduğudur; boş metin ile
 * "başlangıçta boştu" durumunu ayırt etmek için saklanır.
 */
export interface ApiChatStaging {
  addedAttachments: string[]
  appendedText: string
  baseInput: string
}

export function createApiChatStaging(): ApiChatStaging {
  return { addedAttachments: [], appendedText: '', baseInput: '' }
}

/** Eklenti listesine kaynakları ekler ve kaydı doldurur. */
export function stageApiChatAttachments(
  staging: ApiChatStaging,
  read: ChatUiStateReader,
  tabId: string,
  prepared: string[]
): void {
  for (const data of prepared) {
    if (typeof data !== 'string' || data.length === 0) continue
    read().addAttachment(tabId, data)
    staging.addedAttachments.push(data)
  }
}

/**
 * Talimatı girdi kutusuna ekler.
 *
 * Kutu doluysa **sona ekler** (kullanıcının yazdığı metin ezilmez); boşsa
 * doğrudan yerleştirir. `promptText` yoksa ve kutu boşsa, eklerin tek başına
 * anlamsız kalmaması için kısa bir tohum talimatı yazılır.
 */
export function stageApiChatInput(
  staging: ApiChatStaging,
  read: ChatUiStateReader,
  tabId: string,
  text: string | null | undefined,
  fallbackSeed?: string
): void {
  const addition = text?.trim() ? text : ''
  const current = read().inputValueByTab[tabId] || ''
  if (!addition) {
    // Talimat yok: yalnızca kutu tamamen boşsa tohum yazılır.
    const seed = fallbackSeed?.trim() ?? ''
    if (seed && !current.trim()) {
      staging.baseInput = current
      staging.appendedText = seed
      read().updateInput(tabId, seed)
    }
    return
  }
  staging.baseInput = current
  staging.appendedText = addition
  read().updateInput(tabId, current ? `${current}${API_CHAT_INPUT_SEPARATOR}${addition}` : addition)
}

/**
 * Teslim gerçekleşmediyse yalnızca bu katmanın eklediği parçaları geri alır.
 *
 * Her iki adım da "hâlâ bizim yazdığımız hâlde mi?" diye sorar; kullanıcı araya
 * girdiğinde hiçbir şeye dokunulmaz.
 */
export function rollbackApiChatStaging(
  read: ChatUiStateReader,
  tabId: string,
  staging: ApiChatStaging
): void {
  const state = read()

  if (staging.appendedText) {
    const current = state.inputValueByTab[tabId] || ''
    if (staging.baseInput === '') {
      if (current === staging.appendedText) state.updateInput(tabId, '')
    } else {
      const tail = `${API_CHAT_INPUT_SEPARATOR}${staging.appendedText}`
      if (current.endsWith(tail)) {
        state.updateInput(tabId, current.slice(0, current.length - tail.length))
      }
    }
  }

  if (staging.addedAttachments.length > 0) {
    const state = read()
    // Her eklediğimiz kaynak **kimliğiyle** bulunur ve düşürülür; kalan hiçbir
    // şeye (kullanıcının eki, araya giren yeni ek) dokunulmaz.
    //
    // Yalnızca "sondaki eşleşmeleri" kaldırmak yetmezdi: kullanıcı araya bir
    // ek daha eklediğinde bizim eklerimiz artık sonda olmaz ve mükerrer mesaj
    // riski tam olarak ihtiyaç duyulan anda geri gelirdi.
    for (let i = staging.addedAttachments.length - 1; i >= 0; i--) {
      const target = staging.addedAttachments[i]
      const index = (state.attachmentsByTab[tabId] || []).indexOf(target)
      if (index !== -1) state.removeAttachment(tabId, index)
    }
  }
}
