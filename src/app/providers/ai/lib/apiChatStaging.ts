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
 * ## İşlem günlüğü (transaction log)
 *
 * `ApiChatStaging` bir "yaptıklarım" defteridir. **Her mutasyon önce
 * deftere yazılır, sonra uygulanır.** Uygulama patlarsa bile kayıt durur ve
 * telafi o kaydı geri alabilir; tersi (uygula, sonra kaydet) patlamanın
 * tam olarak telafiyi atladığı durumdur. Bu yüzden `runApiChatSend` bir
 * `staged` bayrağına değil, bu defterde kayıt olup olmamasına bakar.
 *
 * ## Sahiplik (ownership)
 *
 * Ekler düz metin (`data:` URL) olarak tutulur; depoda kimlik/token yoktur.
 * Bu yüzden sahiplik **aynı değerin kaçıncı kopyası** üzerinden kurulur:
 * eklemeden önce listede kaç kopya olduğu sayılır, eklenen bu sayının
 * `n + j`inci kopyasıdır. Geri alma da tam olarak o kopyayı hedefler.
 *
 * Saf içerik eşleşmesi (`indexOf`) **sahiplik değildir**: kullanıcının aynı
 * görseli eklemiş olması durumunda `indexOf` kullanıcının kopyasını bulur ve
 * otomasyonun ekini bırakır — hem kullanıcı verisi kaybolur hem mükerrer
 * ek kalır.
 *
 * ## Telafinin sınırı
 *
 * Geri alma **kendi eklediğimiz ve hâlâ yerinde duran** içeriği hedefler:
 *
 * - Girdi: eklediğimiz blok hâlâ sonundaysa kesilir; kullanıcı araya yazdıysa
 *   metne hiç dokunulmaz (kullanıcının verisi telafiye feda edilmez).
 * - Ekler: yalnızca bizim eklediğimiz kopyalar düşürülür.
 *
 * Telafi bir `void` değil, **sonuç** döndürür. Tam telafi edilemezse üst
 * katman bunu bilmelidir: kısmen geri alınmış bir gönderimi otomatik tekrar
 * etmek hedefte ikinci bir kopya bırakır.
 */

/** Eklenen metnin girdiye yapıştırıldığı ayırıcı. */
const API_CHAT_INPUT_SEPARATOR = '\n'

/**
 * Bu modülün ihtiyaç duyduğu depo yüzeyi.
 *
 * Tüm `ChatUiStore` değil, yalnızca yazma/geri alma için gereken alanlar:
 * yardımcı ne okuyor ne de değiştiriyorsa sözleşmeye girmemelidir. Gerçek
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
 * Eklediğimiz tek bir ekin kimliği.
 *
 * `data` ekin içeriği, `occurrence` ise bu içeriğin listedeki **kaçıncı
 * kopyası** olduğu (0 tabanlı). Ekleme anında mevcut kopya sayısı kadar olan
 * bir kayıt, eklemeden sonra o kopyaya işaret eder.
 */
interface StagedAttachmentRef {
  data: string
  occurrence: number
}

/**
 * Bir gönderim hazırlığının geri alınabilir kaydı.
 *
 * `baseInput`, eklemeden **önce** kutuda ne olduğudur; boş metin ile
 * "başlangıçta boştu" durumunu ayırt etmek için saklanır.
 */
export interface ApiChatStaging {
  /** Eklenen ekler, eklenme sırasıyla. */
  addedAttachments: StagedAttachmentRef[]
  appendedText: string
  baseInput: string
}

export function createApiChatStaging(): ApiChatStaging {
  return { addedAttachments: [], appendedText: '', baseInput: '' }
}

/**
 * Bu kayıtta **geri alınabilecek bir mutasyon var mı?**
 *
 * `runApiChatSend` telafiyi bu sorunun cevabına göre çalıştırır; bir
 * "hazırlandı" bayrağı değil. Hazırlama adımlarından biri kısmen uygulanıp
 * hata verirse bile kayıt doludur ve telafi kaçmaz.
 */
export function hasStagedMutations(staging: ApiChatStaging): boolean {
  return staging.addedAttachments.length > 0 || staging.appendedText.length > 0
}

/** Eklenti listesinde `data` değerinin kaç kopyası olduğunu sayar. */
function countOccurrences(list: string[], data: string): number {
  let count = 0
  for (const item of list) {
    if (item === data) count += 1
  }
  return count
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
    // Kayıt önce yazılır: `addAttachment` patlarsa bile telafi bu kopyayı
    // hedefleyebilir (hatta kısmen eklendiğinde gerçekten kaldıracak).
    const occurrence = countOccurrences(read().attachmentsByTab[tabId] || [], data)
    staging.addedAttachments.push({ data, occurrence })
    read().addAttachment(tabId, data)
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
 * Telafinin ne kadar başardığı.
 *
 * - `fully_reverted` — kayıttaki her şey geri alındı; hedef eski halinde.
 * - `partially_reverted` — bir kısımı geri alındı, bir kısmı hedefte kaldı.
 * - `user_modified` — hedefe **kullanıcı dokunduğu için** geri alınamadı;
 *   kullanıcının verisi korundu ama otomasyonun parçası da duruyor.
 *
 * `partially_reverted` ve `user_modified` sonuçlarında otomatik yeniden
 * ekleme/ekleme **yapılmaz**: hedefte zaten bizim içeriğimiz duruyordur.
 */
export type ApiChatRollbackResult = 'fully_reverted' | 'partially_reverted' | 'user_modified'

/** Telafi için mutasyon kaydı yoksa sonuç "tam"dır (yapılacak bir şey yok). */
const NOOP_ROLLBACK: ApiChatRollbackResult = 'fully_reverted'

/**
 * Teslim gerçekleşmediyse yalnızca bu katmanın eklediği parçaları geri alır.
 *
 * Her iki adım da "hâlâ bizim yazdığımız hâlde mi?" diye sorar; kullanıcı araya
 * girdiğinde hiçbir şeye dokunulmaz. Dönüş değeri, üst katmanın "otomatik
 * tekrar güvenli mi?" kararını **void** bir çağrıdan beslemek yerine gerçek
 * bilgiyle verir.
 *
 * ## "Bulamadım" ile "sildim" aynı şey değildir
 *
 * Eklediğimiz metin kutuda **bulunamazsa** onu geri almış saymak yanlıştır.
 * `sendApiChatMessage` kullanıcı mesajını transcript'e yazdıktan sonra kutuyu
 * temizler (`updateInput(tabId, '')`); istek başarısız olduğunda metin tüketilmiş
 * olur ve telafi aradığı şeyi bulamaz. "Temiz" görünen bu hedef, transcript'te
 * kullanıcının mesajını zaten taşır.
 *
 * Bu yüzden `textReverted` yalnızca **kanıtla** geri alındığında doğru kalır.
 * Bulunamadığı durumda `false` döner; sonuç `partially_reverted` olur ve üst
 * katman `partial` işaretler — yani otomatik tekrar kapalı kalır. Aksi halde
 * `not_started` üretilir, kullanıcı "tekrar dene" der ve transcript'e ikinci bir
 * kopya yazılır.
 */
export function rollbackApiChatStaging(
  read: ChatUiStateReader,
  tabId: string,
  staging: ApiChatStaging
): ApiChatRollbackResult {
  if (!hasStagedMutations(staging)) return NOOP_ROLLBACK

  let textReverted = true
  let textBlockedByUser = false

  if (staging.appendedText) {
    const current = read().inputValueByTab[tabId] || ''
    if (staging.baseInput === '') {
      if (current === staging.appendedText) read().updateInput(tabId, '')
      else if (current.includes(staging.appendedText)) {
        // Eklediğimiz metin hâlâ kutuda ama kullanıcı da yazmış: silmek
        // kullanıcının verisini bozardı.
        textReverted = false
        textBlockedByUser = true
      } else {
        textReverted = false
      }
    } else {
      const tail = `${API_CHAT_INPUT_SEPARATOR}${staging.appendedText}`
      if (current.endsWith(tail)) {
        read().updateInput(tabId, current.slice(0, current.length - tail.length))
      } else if (current.includes(staging.appendedText)) {
        textReverted = false
        textBlockedByUser = true
      } else {
        textReverted = false
      }
    }
  }

  let attachmentsReverted = 0
  if (staging.addedAttachments.length > 0) {
    // Her eklediğimiz kaynak **kendi kopyasıyla** bulunur ve düşürülür; kalan
    // hiçbir şeye (kullanıcının eki, araya giren yeni ek) dokunulmaz.
    //
    // Yalnızca "sondaki eşleşmeleri" kaldırmak yetmezdi: kullanıcı araya bir
    // ek daha eklediğinde bizim eklerimiz artık sonda olmaz ve mükerrer mesaj
    // riski tam olarak ihtiyaç duyulan anda geri gelirdi. Yalnızca "ilk içerik
    // eşleşmesi" (`indexOf`) de yetmezdi: kullanıcının **aynı** görseli
    // eklemiş olması durumunda kullanıcının kopyasını silerdik.
    for (let i = staging.addedAttachments.length - 1; i >= 0; i--) {
      const { data, occurrence } = staging.addedAttachments[i]
      const list = read().attachmentsByTab[tabId] || []
      const seen: number[] = []
      for (let index = 0; index < list.length; index++) {
        if (list[index] === data) seen.push(index)
      }
      const target = seen[occurrence]
      if (target === undefined) continue
      read().removeAttachment(tabId, target)
      attachmentsReverted += 1
    }
  }

  if (textReverted && attachmentsReverted === staging.addedAttachments.length) {
    return 'fully_reverted'
  }
  return textBlockedByUser ? 'user_modified' : 'partially_reverted'
}
