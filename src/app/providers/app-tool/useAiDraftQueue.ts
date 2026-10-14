import { Logger, reportSuppressedError } from '@shared/lib/logger'

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'

import type { PdfSourceMeta } from '../ai/pdfSource'
import type { AiDraftImageItem, AiDraftItem, SelectionPosition } from '../ai/types'
import { buildPendingId, clearBrowserTextSelection } from './appToolUtils'

export type QueuedImageMeta = Partial<Pick<AiDraftImageItem, 'page' | 'captureKind'>> & {
  source?: PdfSourceMeta | null
}

export interface QueuedTextMeta {
  source?: PdfSourceMeta | null
}

/** Taslak kuyruğunun üst sınırı. Dolduğunda yeni öğe reddedilir, mevcut korunur. */
export const MAX_QUEUE_SIZE = 20

/** Bu boyutun altındaki base64 önizlemesi eşzamanlı üretilir; üstü asenkron. */
const SYNC_BLOB_BASE64_LIMIT = 2_000_000

/** Kuyruk yalnızca `blob:` önizlemeleri üretir; `data:` URL'ler yeniden üretilmez. */
function revokeBlobUrl(url: string | null | undefined) {
  if (!url || !url.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // best-effort: iptal başarısız olsa bellek temizliği kritik değildir
  }
}

/** Öğenin kuyruğa ait tek kaynaklı blob önizlemesi (yoksa boş). */
function itemBlobUrl(draft: AiDraftItem): string {
  return draft.type === 'image' && draft.blobUrl ? draft.blobUrl : ''
}

/**
 * Kuyrukta **o an ayakta duran** blob URL'ler.
 *
 * Kaynak referans sayısıyla yönetilir: iki öğe aynı `blob:` URL'sini
 * paylaşabilir (aynı yakalamanın iki kez kuyruğa eklenmesi ya da
 * `resolveLargePreview`nin iki öğeye aynı URL'yi yazması). Bir öğe kaldırıldığında
 * URL, hâlâ onu kullanan başka bir öğe varsa **iptal edilmez** — iptal edilirse
 * diğer öğenin önizlemesi kırılır ve gönderim yolundaki `blobUrlToDataUrl` da
 * başarısız olur. Yani "öğe gitti" ile "kaynak serbest kaldı" aynı şey değildir.
 */
function survivingBlobUrls(items: AiDraftItem[]): Set<string> {
  const urls = new Set<string>()
  for (const draft of items) {
    const url = itemBlobUrl(draft)
    if (url) urls.add(url)
  }
  return urls
}

/** `data:image/...;base64,` → bayt dizisi + mime. Geçersizse null. */
function decodeDataUrlToBytes(
  dataUrl: string
): { bytes: Uint8Array<ArrayBuffer>; mime: string } | null {
  try {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const mime = dataUrl.match(/^data:([^;,]+)[;,]/)?.[1] ?? 'image/png'
    const binary = atob(base64)
    const bytes = new Uint8Array(new ArrayBuffer(binary.length))
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { bytes, mime }
  } catch {
    return null
  }
}

/**
 * Pahalı işi **görüntülenebilir bir görev sınırından sonra** başlatır.
 *
 * `Promise.resolve().then(...)` bir mikro-görevdir: tarayıcı ondan önce boya
 * yapamaz, yani "asenkron" etiketi yanıltıcı olur ve decode yine ana iş
 * parçacığında, kullanıcının girdisine cevap vermeden başlar. `setTimeout(0)`
 * ise gerçek bir görev sınırıdır: araya en az bir boyama fırsatı girer.
 *
 * Bu işi **başka bir iş parçacığına** taşımaz — projede genel amaçlı bir
 * Worker/utility altyapısı yoktur ve sırf bu iş için yeni bir servis kurmak
 * kapsam dışıdır. Taşınan şey, bloklamanın *zamanlamasıdır*: iptal edilen
 * bir yakalamada iş başlamadan önce çıkış yolu açık kalır.
 */
function yieldToRendererTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/**
 * Taslak kuyruğu — tek mutasyon yolu ve kapasite sözleşmesi.
 *
 * ## Sözleşme
 *
 * `queueTextForAi` / `queueImageForAi` **gerçek sonucu** döndürür: kabul
 * edildiyse `true`, reddedildiyse `false`. Çağıran bu sonucu **kontrol etmek
 * zorundadır**; `void` ile tüketmek, reddedilen bir eklemeyi kullanıcıya
 * başarı diye göstermeye yol açar.
 *
 * Kapasite dolduğunda yeni öğe reddedilir; mevcut öğeler **korunur** (sessiz
 * silme yok). Kullanıcı `onReject` üzerinden açık uyarı alır ve öğelerini
 * çıkararak devam edebilir.
 *
 * ## Tek doğruluk kaynağı
 *
 * `itemsRef` React state'in **anlık** karşılığıdır. Kapasite, kaldırma ve
 * kaynak yaşam döngüsü kararlarının hepsi buradan okunur. Ayrı bir sayaç ref'i
 * (`queueSizeRef`) veya `useEffect` ile senkronizasyon kullanılsaydı, aynı olay
 * içindeki ardışık ekleme/kaldırma kaydırma yaşatır ve geçersiz bir `id` ile
 * kaldırma sayacı sessizce düşürürdü.
 *
 * ## Yan etki ve state ayrımı
 *
 * Tüm mutasyonlar `commit` üzerinden geçer. Blob URL iptali gibi **geri
 * alınamaz** yan etkiler `setState` updater'ının içinde değil, çağrıdan sonra
 * yapılır: React updater fonksiyonlarını StrictMode'da ve kesintiye uğrayan
 * renderlarda yeniden çalıştırabilir; geri alınamaz bir etkiyi onun içine
 * koymak, hâlâ kuyrukta olan öğelerin kaynağını iptal eder.
 */
export function useAiDraftQueue(onReject?: () => void) {
  const [queue, setQueue] = useState<AiDraftItem[]>([])

  /** Tek doğruluk kaynağı — `useEffect` ile senkronlanmaz, tam tersi. */
  const itemsRef = useRef<AiDraftItem[]>([])

  const onRejectRef = useRef(onReject)
  onRejectRef.current = onReject

  useEffect(() => {
    // Unmount'ta kalan kaynakları iptal et. Kalan küme **temizleme anında**
    // okunur: etki gövdesi mount'ta çalışır ve o an kuyruk daha boştur.
    return () => {
      const remaining = itemsRef.current
      itemsRef.current = []
      for (const url of survivingBlobUrls(remaining)) revokeBlobUrl(url)
    }
  }, [])

  /**
   * Tek mutasyon yolu.
   *
   * - `itemsRef` **senkron** güncellenir → aynı olaydaki ardışık çağrılar
   *   güncel sayıyı görür.
   * - React'e **düz dizi** verilir; updater fonksiyonu hiç çalıştırılmaz,
   *   dolayısıyla StrictMode'un çift çağırması yan etki üretmez.
   * - Kuyruktan ayrılan kaynaklar burada, çağrıdan **sonra** iptal edilir ve
   *   yalnızca artık hiçbir öğe tarafından kullanılmayanlar için.
   */
  const commit = useCallback((next: AiDraftItem[]) => {
    const previous = itemsRef.current
    itemsRef.current = next
    setQueue(next)

    const survivors = survivingBlobUrls(next)
    // Paylaşılan URL: bir öğe çıktı ama başka bir öğe onu hâlâ kullanıyorsa
    // iptal edilmez. Referans sayısı burada "kalan küme boş mu" sorusudur.
    for (const url of survivingBlobUrls(previous)) {
      if (!survivors.has(url)) revokeBlobUrl(url)
    }
  }, [])

  /**
   * Gönderim orkestrasyonu bu setter'ı doğrudan çağırır. Aynı yazma,
   * iptal ve kaynak yaşam döngüsü kuralları geçerli olsun diye `commit`
   * üzerinden yönlendirilir.
   */
  const setPendingAiItems = useCallback<Dispatch<SetStateAction<AiDraftItem[]>>>(
    (action) => {
      const previous = itemsRef.current
      commit(typeof action === 'function' ? action(previous) : action)
    },
    [commit]
  )

  const queueTextForAi = useCallback(
    (
      text: string,
      position?: SelectionPosition | null,
      meta?: QueuedTextMeta | PdfSourceMeta | null
    ): boolean => {
      const normalized = text.trim()
      if (!normalized) return false

      // Üçüncü argüman hem { source } hem de doğrudan PdfSourceMeta olabilir.
      const source =
        meta && typeof meta === 'object' && 'page' in meta && 'docId' in meta
          ? (meta as PdfSourceMeta)
          : ((meta as QueuedTextMeta | null)?.source ?? null)

      // Kapasite kontrolü `itemsRef` üzerinden: aynı olayda ikinci bir ekleme
      // zaten uygulanmış sayıyı görür. Mevcut öğeler sessizce silinmez.
      if (itemsRef.current.length >= MAX_QUEUE_SIZE) {
        Logger.warn(
          `[DraftQueue] Queue full (${MAX_QUEUE_SIZE}); new text item rejected, existing items kept`
        )
        onRejectRef.current?.()
        return false
      }

      const draft: AiDraftItem = {
        id: buildPendingId('text'),
        type: 'text',
        text: normalized,
        position: position ?? null,
        source,
        createdAt: Date.now()
      }

      commit([...itemsRef.current, draft])
      return true
    },
    [commit]
  )

  /**
   * Büyük yakalamanın önizleme URL'ini asenkron üretir.
   *
   * Kuyruk, iş tamamlandığında öğenin hâlâ durduğunu **gerçek kuyruk
   * durumundan** sorar (kimlik listesi gibi ikinci bir gerçek kaynağı tutmaz).
   * Öğe bu arada kaldırıldıysa, temizlendiyse veya **başarıyla gönderildiyse**
   * üretilen URL sahipsiz kalırdı; bu yüzden burada geri alınır.
   */
  const resolveLargePreview = useCallback(
    (draftId: string, dataUrl: string) => {
      void yieldToRendererTask()
        .then(() => {
          const decoded = decodeDataUrlToBytes(dataUrl)
          return decoded
            ? URL.createObjectURL(new Blob([decoded.bytes], { type: decoded.mime }))
            : null
        })
        .then((url) => {
          if (!url) return
          const current = itemsRef.current
          const index = current.findIndex((item) => item.id === draftId)
          const item = index === -1 ? null : current[index]
          if (!item || item.type !== 'image') {
            // Öğe artık kuyrukta değil (kaldırıldı, temizlendi ya da **başarıyla
            // gönderildi**): kullanılmayacak URL'i hemen geri al.
            revokeBlobUrl(url)
            return
          }
          const next = [...current]
          next[index] = { ...item, blobUrl: url }
          commit(next)
        })
        .catch((err) => {
          // Composer, blobUrl çözülene kadar yer tutucu gösterir; bu yüzden
          // hata yalnızca eksik bir önizlemeye dönüşür. Satır içi dataUrl yine
          // gönderilebilir durumdadır; yutmayıp raporla.
          reportSuppressedError('draftQueue.imageBlobUrlLarge', { cause: err })
        })
    },
    [commit]
  )

  const queueImageForAi = useCallback(
    (imageUri: string, imageMeta?: QueuedImageMeta): boolean => {
      // 1) Kaynak doğrulaması — ucuz, hiçbir kaynak üretmez.
      const isBlobSource = imageUri.startsWith('blob:')
      const isDataSource = imageUri.startsWith('data:image/')
      if (!isBlobSource && !isDataSource) {
        Logger.warn('[DraftQueue] Unsupported image source rejected')
        return false
      }

      // 2) Kapasite kontrolü, **hiçbir kaynak üretilmeden** yapılır. Reddedilen
      //    bir öğe için base64 decode + Blob + createObjectURL + revoke
      //    döngüsüne girilmez; çağıranın blob'u da onun sahipliğinde kalır.
      if (itemsRef.current.length >= MAX_QUEUE_SIZE) {
        Logger.warn(
          `[DraftQueue] Queue full (${MAX_QUEUE_SIZE}); new image item rejected, existing items kept`
        )
        onRejectRef.current?.()
        return false
      }

      const draftId = buildPendingId('image')
      const dataUrl = isDataSource ? imageUri : undefined
      let blobUrl = ''

      if (isBlobSource) {
        // Sahiplik devri: kabul edildiği için kuyruk bu URL'i üstlenir. Çağıran
        // (yakalama hattı) artık onu iptal etmemelidir — iki katman aynı URL'i
        // sahiplenirse biri diğerinin önizlemesini öldürür.
        blobUrl = imageUri
      } else if ((dataUrl?.length ?? 0) <= SYNC_BLOB_BASE64_LIMIT) {
        // **Boyut kontrolü decode'dan önce gelir.** Önceki sıralamada decode
        // koşulsuz çalışıyor, sonra uzunluk ölçülüyordu; büyük bir yakalamada
        // megabaytlık base64'in `atob` + bayt döngüsü sonucu hemen çöpe
        // atılıyor, sonra `resolveLargePreview` aynı işi **yeniden** yapıyordu.
        // Yani büyük görsel iki kez decode ediliyordu; biri gereksizdi.
        const decoded = dataUrl ? decodeDataUrlToBytes(dataUrl) : null
        if (decoded) {
          try {
            // Küçük yakalamalar: önizleme eşzamanlı üretilir, böylece bileşen
            // ilk render'da hazır bir önizleme görür.
            blobUrl = URL.createObjectURL(new Blob([decoded.bytes], { type: decoded.mime }))
          } catch (err) {
            reportSuppressedError('draftQueue.imageBlobUrl', { cause: err })
            // dataUrl durur; gönderim yolu doğrudan onu kullanır.
            blobUrl = ''
          }
        }
      }
      // Büyük yakalamalar: önizleme görev sınırından sonra üretilir
      // (`resolveLargePreview`). fetch(data:) Electron CSP'sinde `connect-src`
      // tarafından engellenir, bu yüzden yerel decode kullanılır.

      commit([
        ...itemsRef.current,
        {
          id: draftId,
          type: 'image',
          ...(dataUrl ? { dataUrl } : {}),
          blobUrl,
          ...imageMeta,
          source: imageMeta?.source ?? null,
          createdAt: Date.now()
        }
      ])

      if (dataUrl && !blobUrl) {
        resolveLargePreview(draftId, dataUrl)
      }

      return true
    },
    [commit, resolveLargePreview]
  )

  const removePendingAiItem = useCallback(
    (id: string) => {
      const current = itemsRef.current
      // Geçersiz ya da ikinci kez kaldırılan kimlik: kuyruk zaten değişmedi,
      // dolayısıyla hiçbir sayaç da değişmemeli (ayrı sayaç tutulmadığı için
      // "kaydırma" imkânı da ortadan kalkar).
      if (!current.some((draft) => draft.id === id)) return
      commit(current.filter((draft) => draft.id !== id))
    },
    [commit]
  )

  const clearPendingAiItems = useCallback(() => {
    clearBrowserTextSelection()
    commit([])
  }, [commit])

  return {
    pendingAiItems: queue,
    // Orkestrasyon okuma erişimi için bu ref'i kullanır; `itemsRef` ile aynı
    // nesnedir, dolayısıyla iki kopya ayrışamaz.
    pendingAiItemsRef: itemsRef,
    setPendingAiItems,
    queueTextForAi,
    queueImageForAi,
    removePendingAiItem,
    clearPendingAiItems
  }
}
