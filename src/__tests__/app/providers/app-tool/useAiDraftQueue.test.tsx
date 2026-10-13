import { MAX_QUEUE_SIZE, useAiDraftQueue } from '@app/providers/app-tool/useAiDraftQueue'
import type { AiDraftItem } from '@app/providers/ai/types'

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Ayrım tipli kuyruk öğesinden güvenli okuma (union erişimi). */
const textOf = (item: AiDraftItem): string => (item.type === 'text' ? item.text : '')
const blobOf = (item: AiDraftItem): string => (item.type === 'image' ? (item.blobUrl ?? '') : '')

describe('useAiDraftQueue', () => {
  const mockCreateObjectURL = vi.fn(() => 'blob:preview')
  const mockRevokeObjectURL = vi.fn()
  const OriginalUrl = URL

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'URL',
      Object.assign(OriginalUrl, {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('revokes image preview URLs when items are cleared', () => {
    const { result } = renderHook(() => useAiDraftQueue())

    act(() => {
      result.current.queueImageForAi('data:image/png;base64,aGVsbG8=')
    })

    act(() => {
      result.current.clearPendingAiItems()
    })

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('revokes pending image preview URLs on unmount', () => {
    const { result, unmount } = renderHook(() => useAiDraftQueue())

    act(() => {
      result.current.queueImageForAi('data:image/png;base64,aGVsbG8=')
    })

    unmount()

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('keeps duplicate large-image previews associated with their own draft ids', async () => {
    mockCreateObjectURL.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second')
    const { result } = renderHook(() => useAiDraftQueue())
    const largeDataUrl = `data:image/png;base64,${'QUJD'.repeat(500001)}`

    await act(async () => {
      result.current.queueImageForAi(largeDataUrl)
      result.current.queueImageForAi(largeDataUrl)
      await new Promise((r) => setTimeout(r, 100))
    })

    const blobUrls = result.current.pendingAiItems.flatMap((item) =>
      item.type === 'image' ? [item.blobUrl] : []
    )
    expect(blobUrls).toEqual(['blob:first', 'blob:second'])
  })

  it('revokes a preview created for an item removed during conversion', async () => {
    mockCreateObjectURL.mockReturnValueOnce('blob:orphan')
    const { result } = renderHook(() => useAiDraftQueue())
    const largeDataUrl = `data:image/png;base64,${'QUJD'.repeat(500001)}`

    await act(async () => {
      result.current.queueImageForAi(largeDataUrl)
    })
    const id = result.current.pendingAiItems[0].id
    await act(async () => {
      result.current.removePendingAiItem(id)
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:orphan')
  })

  it('resolves large data URL previews with local decode (no fetch)', async () => {
    const { result } = renderHook(() => useAiDraftQueue())

    // >= 2MB base64 takes the large-capture branch, which must not rely on
    // fetch(data:) — blocked by connect-src under Electron's CSP.
    const largeDataUrl = `data:image/png;base64,${'QUJD'.repeat(500001)}`
    await act(async () => {
      result.current.queueImageForAi(largeDataUrl)
      // flush the preview-resolution microtasks
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(mockCreateObjectURL).toHaveBeenCalled()
  })

  /**
   * Aynı `blob:` URL'i iki öğe kullanabilir (aynı yakalamanın iki kez
   * kuyruğa eklenmesi, ya da çağıranın tek bir kaynağı iki öğeye vermesi).
   * "Öğe gitti" ile "kaynak serbest kaldı" aynı şey **değildir**: iptal
   * edilirse ikinci öğenin önizlemesi ve — daha önemlisi — gönderim yolundaki
   * `blobUrlToDataUrl` kırılır.
   */
  describe('shared blob ownership', () => {
    it('keeps the source alive while another item still uses it', () => {
      const { result } = renderHook(() => useAiDraftQueue())

      act(() => {
        result.current.queueImageForAi('blob:shared')
        result.current.queueImageForAi('blob:shared')
      })
      const [first, second] = result.current.pendingAiItems

      act(() => {
        result.current.removePendingAiItem(first.id)
      })

      // İlk öğe çıktı ama URL'i kullanan öğe duruyor → iptal YOK.
      expect(mockRevokeObjectURL).not.toHaveBeenCalledWith('blob:shared')
      expect(result.current.pendingAiItems).toHaveLength(1)
      expect(blobOf(result.current.pendingAiItems[0])).toBe('blob:shared')
      expect(blobOf(second)).toBe('blob:shared')
    })

    it('releases the source only after the last item using it is gone', () => {
      const { result } = renderHook(() => useAiDraftQueue())

      act(() => {
        result.current.queueImageForAi('blob:shared')
        result.current.queueImageForAi('blob:shared')
      })
      const [first, second] = result.current.pendingAiItems

      act(() => {
        result.current.removePendingAiItem(first.id)
      })
      act(() => {
        result.current.removePendingAiItem(second.id)
      })

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:shared')
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1)
    })

    it('revokes each distinct source exactly once on clear', () => {
      const { result } = renderHook(() => useAiDraftQueue())

      act(() => {
        result.current.queueImageForAi('blob:a')
        result.current.queueImageForAi('blob:a')
        result.current.queueImageForAi('blob:b')
      })

      act(() => {
        result.current.clearPendingAiItems()
      })

      // Paylaşılan 'a' iki kez sayılmaz; iki ayrı kaynak iki kez iptal edilir.
      const revoked = mockRevokeObjectURL.mock.calls.map((c) => c[0])
      expect(revoked.sort()).toEqual(['blob:a', 'blob:b'])
    })

    it('leaves no unreleased source behind after unmount', () => {
      const { result, unmount } = renderHook(() => useAiDraftQueue())

      act(() => {
        result.current.queueImageForAi('blob:a')
        result.current.queueImageForAi('blob:a')
        result.current.queueImageForAi('blob:b')
      })

      unmount()

      const revoked = mockRevokeObjectURL.mock.calls.map((c) => c[0])
      expect(revoked.sort()).toEqual(['blob:a', 'blob:b'])
    })
  })

  /**
   * Büyük yakalamada decode **bir kez** yapılır.
   *
   * `atob` + bayt döngüsü ana iş parçacığında çalışır; önceki sıralamada
   * büyük görsel önce burada decode ediliyor, sonra `resolveLargePreview`
   * aynı işi yeniden yapıyordu. Boyut kontrolü decode'dan önce geldiği için
   * artık tek geçiş vardır.
   */
  describe('large-image decode', () => {
    it('decodes a large data URL exactly once', async () => {
      const { result } = renderHook(() => useAiDraftQueue())
      const largeDataUrl = `data:image/png;base64,${'QUJD'.repeat(500001)}`
      const atobSpy = vi.spyOn(globalThis, 'atob')

      await act(async () => {
        result.current.queueImageForAi(largeDataUrl)
        await new Promise((r) => setTimeout(r, 100))
      })

      expect(atobSpy).toHaveBeenCalledTimes(1)
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      atobSpy.mockRestore()
    })

    it('still produces a preview for a small data URL', () => {
      const { result } = renderHook(() => useAiDraftQueue())

      act(() => {
        result.current.queueImageForAi('data:image/png;base64,aGVsbG8=')
      })

      expect(blobOf(result.current.pendingAiItems[0])).toBe('blob:preview')
    })
  })

  /**
   * Kapasite sözleşmesi: sınır 20'de doludur, **mevcut öğeler korunur** ve
   * ekleme gerçekten reddedilir (boolean sonucu tüketicilere ulaşmalıdır).
   */
  describe('capacity', () => {
    const fill = (result: { current: ReturnType<typeof useAiDraftQueue> }, count: number) => {
      for (let i = 0; i < count; i++) {
        act(() => {
          result.current.queueTextForAi(`item ${i}`)
        })
      }
    }

    it('accepts up to exactly the documented limit', () => {
      const { result } = renderHook(() => useAiDraftQueue())

      fill(result, MAX_QUEUE_SIZE - 1)
      let accepted = false
      act(() => {
        accepted = result.current.queueTextForAi('the last slot')
      })

      expect(accepted).toBe(true)
      expect(result.current.pendingAiItems).toHaveLength(MAX_QUEUE_SIZE)
    })

    it('rejects the item past the limit, keeps the existing ones and reports it', () => {
      const onReject = vi.fn()
      const { result } = renderHook(() => useAiDraftQueue(onReject))

      fill(result, MAX_QUEUE_SIZE)
      let accepted = true
      act(() => {
        accepted = result.current.queueTextForAi('one too many')
      })

      expect(accepted).toBe(false)
      // Kullanıcının seçtiği içerik sessizce silinmez.
      expect(result.current.pendingAiItems).toHaveLength(MAX_QUEUE_SIZE)
      expect(textOf(result.current.pendingAiItems[MAX_QUEUE_SIZE - 1])).toBe(
        `item ${MAX_QUEUE_SIZE - 1}`
      )
      expect(onReject).toHaveBeenCalledTimes(1)
    })

    it('rejects images too and never mints a preview URL for a rejected item', () => {
      const onReject = vi.fn()
      const { result } = renderHook(() => useAiDraftQueue(onReject))

      fill(result, MAX_QUEUE_SIZE)
      let accepted = true
      act(() => {
        accepted = result.current.queueImageForAi('data:image/png;base64,aGVsbG8=')
      })

      expect(accepted).toBe(false)
      expect(result.current.pendingAiItems).toHaveLength(MAX_QUEUE_SIZE)
      expect(mockCreateObjectURL).not.toHaveBeenCalled()
    })

    it('accepts again after the user makes room', () => {
      const { result } = renderHook(() => useAiDraftQueue(vi.fn()))

      fill(result, MAX_QUEUE_SIZE)
      act(() => {
        result.current.removePendingAiItem(result.current.pendingAiItems[0].id)
      })

      let accepted = false
      act(() => {
        accepted = result.current.queueTextForAi('after making room')
      })

      expect(accepted).toBe(true)
      expect(result.current.pendingAiItems).toHaveLength(MAX_QUEUE_SIZE)
    })
  })

  /**
   * Sayaç kayması (drift) testleri.
   *
   * Eski uygulamada ayrı bir `queueSizeRef` vardı: kaldırma, bulunamayan bir
   * `id` için bile sayacı düşürüyordu; ardından gerçek öğe sayısı 19'a inmiş
   * olmasına rağmen kuyruk 20 kişiye kadar "dolu" sanılıyor ve yeni içerik
   * reddediliyordu.
   */
  describe('counter consistency', () => {
    it('does not count down when removing an unknown id', () => {
      const onReject = vi.fn()
      const { result } = renderHook(() => useAiDraftQueue(onReject))

      act(() => {
        result.current.queueTextForAi('only item')
      })

      act(() => {
        result.current.removePendingAiItem('does-not-exist')
        result.current.removePendingAiItem('does-not-exist')
      })

      expect(result.current.pendingAiItems).toHaveLength(1)
      // Sayaç kaymadığı için kuyruk hâlâ "boş" sayılmalı: yeni içerik kabul edilir.
      let accepted = false
      act(() => {
        accepted = result.current.queueTextForAi('second item')
      })
      expect(accepted).toBe(true)
      expect(result.current.pendingAiItems).toHaveLength(2)
      expect(onReject).not.toHaveBeenCalled()
    })

    it('is idempotent for a repeated removal of the same id', () => {
      const { result } = renderHook(() => useAiDraftQueue(vi.fn()))

      act(() => {
        result.current.queueTextForAi('first')
        result.current.queueTextForAi('second')
      })
      const firstId = result.current.pendingAiItems[0].id

      act(() => {
        result.current.removePendingAiItem(firstId)
        result.current.removePendingAiItem(firstId)
      })

      expect(result.current.pendingAiItems).toHaveLength(1)
      expect(textOf(result.current.pendingAiItems[0])).toBe('second')
    })

    it('counts consecutive adds in the same tick against the real size', () => {
      const onReject = vi.fn()
      const { result } = renderHook(() => useAiDraftQueue(onReject))

      act(() => {
        for (let i = 0; i < 20; i++) result.current.queueTextForAi(`same tick ${i}`)
      })
      expect(result.current.pendingAiItems).toHaveLength(20)

      // Aynı olayın 21. eklemesi de doğru sayılmalı.
      let accepted = true
      act(() => {
        accepted = result.current.queueTextForAi('same tick 21')
      })
      expect(accepted).toBe(false)
      expect(onReject).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * Blob yaşam döngüsü: bir öğe asenkron önizleme üretilirken kaldırılır ya da
   * **başarıyla gönderilirse**, üretilen URL kullanılmaz. `pendingDraftIdsRef`
   * gönderim sonrası temizlenmediği için bu URL sızıyordu.
   */
  describe('async preview lifecycle', () => {
    const largeDataUrl = `data:image/png;base64,${'QUJD'.repeat(500001)}`

    it('revokes the preview when the item is cleared mid-conversion', async () => {
      mockCreateObjectURL.mockReturnValueOnce('blob:late')
      const { result } = renderHook(() => useAiDraftQueue())

      act(() => {
        result.current.queueImageForAi(largeDataUrl)
      })
      expect(blobOf(result.current.pendingAiItems[0])).toBe('')

      act(() => {
        result.current.clearPendingAiItems()
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100))
      })

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:late')
    })

    it('revokes the preview when the item is removed by the send orchestration', async () => {
      // Gönderim, öğeyi `setPendingAiItems` üzerinden düşürür; bu yol da
      // asenkron üretim tamamlanmadan çalışabilir.
      mockCreateObjectURL.mockReturnValueOnce('blob:after-send')
      const { result } = renderHook(() => useAiDraftQueue())

      act(() => {
        result.current.queueImageForAi(largeDataUrl)
      })
      const id = result.current.pendingAiItems[0].id

      act(() => {
        result.current.setPendingAiItems((current) => current.filter((item) => item.id !== id))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100))
      })

      expect(result.current.pendingAiItems).toHaveLength(0)
      // Sızma yok: üretilen URL hemen geri alınır.
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:after-send')
    })

    it('revokes the preview when the item is removed by a direct clear', async () => {
      mockCreateObjectURL.mockReturnValueOnce('blob:direct-clear')
      const { result } = renderHook(() => useAiDraftQueue())

      act(() => {
        result.current.queueImageForAi('data:image/png;base64,aGVsbG8=')
      })
      expect(blobOf(result.current.pendingAiItems[0])).toBe('blob:direct-clear')

      act(() => {
        result.current.setPendingAiItems([])
      })
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:direct-clear')
    })
  })

  /** Desteklenmeyen kaynak sessizce kabul edilmez. */
  it('rejects an unsupported image source instead of queueing it', () => {
    const { result } = renderHook(() => useAiDraftQueue())

    let accepted = true
    act(() => {
      accepted = result.current.queueImageForAi('https://example.com/a.png')
    })

    expect(accepted).toBe(false)
    expect(result.current.pendingAiItems).toHaveLength(0)
    expect(mockCreateObjectURL).not.toHaveBeenCalled()
  })

  it('rejects blank text', () => {
    const { result } = renderHook(() => useAiDraftQueue())

    let accepted = true
    act(() => {
      accepted = result.current.queueTextForAi('   \n  ')
    })

    expect(accepted).toBe(false)
    expect(result.current.pendingAiItems).toHaveLength(0)
  })

  /**
   * `commit` geri alınamaz yan etkileri `setState` updater'ının **içine**
   * koymaz; updater'ı kendisi bir kez çalıştırıp React'e düz dizi verir.
   *
   * Eski uygulamada `URL.revokeObjectURL` updater'ın gövdesindeydi. React bu
   * fonksiyonu StrictMode'da ve kesintiye uğrayan renderlarda yeniden
   * çalıştırabildiği için, hâlâ kuyrukta olan öğelerin önizlemesi iptal
   * edilebiliyordu (kırık görsel) veya aynı URL iki kez iptal ediliyordu.
   */
  it('evaluates a functional update once and never revokes inside it', () => {
    const { result } = renderHook(() => useAiDraftQueue())

    act(() => {
      result.current.queueImageForAi('data:image/png;base64,aGVsbG8=')
    })
    expect(blobOf(result.current.pendingAiItems[0])).toBe('blob:preview')

    let updaterCalls = 0
    mockRevokeObjectURL.mockClear()
    act(() => {
      result.current.setPendingAiItems((current) => {
        updaterCalls += 1
        return current.slice(0, -1)
      })
    })

    expect(updaterCalls).toBe(1)
    // İptal updater dönüşünden SONRA, tam olarak bir kez yapılır.
    expect(mockRevokeObjectURL.mock.calls.filter((c) => c[0] === 'blob:preview')).toHaveLength(1)
  })
})
