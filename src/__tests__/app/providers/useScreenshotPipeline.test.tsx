/**
 * `useScreenshotPipeline` — alan yakalama artık doğrudan kuyruğa yazmaz.
 * Yakalama `pendingAreaCapture` olarak bekletilir; ikili menü
 * (AI'ye Gönder / Taslağa Ekle) karar verene kadar kuyruğa yazılmaz.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const overlay = {
  isScreenshotMode: false,
  startScreenshot: vi.fn(),
  closeScreenshot: vi.fn(),
  handleCapture: vi.fn()
}

vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
  useScreenshot: vi.fn((onCapture: (dataUrl: string, rect?: unknown) => void | Promise<void>) => ({
    ...overlay,
    handleCapture: vi.fn(async (dataUrl: string, rect?: unknown) => {
      await onCapture(dataUrl, rect)
    })
  }))
}))

import { useScreenshotPipeline } from '@app/providers/app-tool/useScreenshotPipeline'

describe('useScreenshotPipeline', () => {
  // `queueImageForAi` artık gerçek boolean sonucunu döndürür. `undefined` dönen
  // bir mock "reddedildi" anlamına gelir; kabul senaryoları için `true` verilir
  // ve reddedilme senaryoları ayrıca açıkça test edilir.
  const queueImageForAi = vi.fn((_dataUrl: string, _meta?: unknown) => true)

  // Kaynak yaşam döngüsü gözlemi: her blob kaynağının iptali sayılır.
  // Kuyruğa devredilen (kabul edilen) kaynak **iptal edilmez**.
  //
  // Spy `beforeEach`'te kurulur: global `afterEach` içindeki
  // `vi.restoreAllMocks()` ilk testten sonra özgün metodu geri yükler; tek
  // seferlik bir spy ikinci testten itibaren gözlem yapmaz ve "çağrılmadı"
  // iddiaları boşuna geçerdi.
  let revokeObjectURL: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    queueImageForAi.mockReturnValue(true)
    revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('stashes the capture as pending instead of queueing immediately', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 4, captureKind: 'selection' })
    })
    expect(overlay.startScreenshot).toHaveBeenCalledTimes(1)
    await act(async () => {
      await result.current.handleCapture('data:image/png;base64,xyz', {
        left: 10,
        top: 20,
        width: 100,
        height: 60
      })
    })

    // Doğrudan kuyruk yok — menü kararı bekler.
    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(result.current.pendingAreaCapture).toMatchObject({
      dataUrl: 'data:image/png;base64,xyz',
      meta: { page: 4, captureKind: 'selection' }
    })
    expect(result.current.pendingAreaCapture?.rect).toMatchObject({ left: 10, top: 20 })
  })

  it('queues only when the pending capture is confirmed as draft', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 4, captureKind: 'selection' })
    })
    await act(async () => {
      await result.current.handleCapture('data:image/png;base64,xyz', null)
    })
    expect(queueImageForAi).not.toHaveBeenCalled()

    let confirmed = false
    act(() => {
      confirmed = result.current.confirmPendingAreaAsDraft()
    })
    expect(confirmed).toBe(true)
    expect(queueImageForAi).toHaveBeenCalledWith('data:image/png;base64,xyz', {
      page: 4,
      captureKind: 'selection'
    })
    expect(result.current.pendingAreaCapture).toBeNull()
  })

  it('drops the pending capture on dismiss without queueing', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 9, captureKind: 'selection' })
    })
    await act(async () => {
      await result.current.handleCapture('first', null)
    })
    act(() => {
      result.current.dismissPendingArea()
    })
    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(result.current.pendingAreaCapture).toBeNull()
  })

  it('a new area selection supersedes the previous pending capture', async () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 9, captureKind: 'selection' })
    })
    await act(async () => {
      await result.current.handleCapture('first', null)
    })
    expect(result.current.pendingAreaCapture?.dataUrl).toBe('first')

    act(() => {
      result.current.startScreenshot()
    })
    // Yeni seçim eski bekleyeni geçersiz kılar.
    expect(result.current.pendingAreaCapture).toBeNull()
  })

  it('tears the overlay down when the user cancels instead of capturing', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 3, captureKind: 'selection' })
    })
    act(() => {
      result.current.closeScreenshot()
    })

    expect(overlay.closeScreenshot).toHaveBeenCalledTimes(1)
    expect(queueImageForAi).not.toHaveBeenCalled()
  })

  it('clears the metadata without leaving screenshot mode', () => {
    const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

    act(() => {
      result.current.startScreenshot({ page: 3, captureKind: 'selection' })
    })
    act(() => {
      result.current.clearScreenshotMeta()
    })

    expect(overlay.closeScreenshot).not.toHaveBeenCalled()
    expect(queueImageForAi).not.toHaveBeenCalled()
  })

  // Regression: the confirmation used to ignore `queueImageForAi`'s result,
  // clear the pending capture and report success even when the queue was full.
  // That both lied to the user and leaked the blob URL.
  describe('rejection by the queue', () => {
    beforeEach(() => {
      revokeObjectURL.mockClear()
    })

    async function stagePendingArea() {
      const rendered = renderHook(() => useScreenshotPipeline({ queueImageForAi }))
      act(() => {
        rendered.result.current.startScreenshot({ page: 4, captureKind: 'selection' })
      })
      await act(async () => {
        await rendered.result.current.handleCapture('blob:pending-area', null)
      })
      return rendered
    }

    it('reports failure and keeps the pending area capture when the queue rejects', async () => {
      const { result } = await stagePendingArea()
      queueImageForAi.mockReturnValueOnce(false)

      let confirmed = true
      act(() => {
        confirmed = result.current.confirmPendingAreaAsDraft()
      })

      expect(confirmed).toBe(false)
      // Yakalama korunur: kullanıcı öğeleri azaltıp yeniden deneyebilir.
      expect(result.current.pendingAreaCapture?.dataUrl).toBe('blob:pending-area')
      // Kaynak iptal edilmez — sahiplik hâlâ yakalama hattında.
      expect(revokeObjectURL).not.toHaveBeenCalled()
    })

    it('reports failure and keeps the pending full-page capture when the queue rejects', () => {
      const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))
      act(() => {
        result.current.offerFullPageCapture('blob:pending-full', { page: 7 })
      })
      queueImageForAi.mockReturnValueOnce(false)

      let confirmed = true
      act(() => {
        confirmed = result.current.confirmPendingFullPageAsDraft()
      })

      expect(confirmed).toBe(false)
      expect(result.current.pendingFullPageCapture?.dataUrl).toBe('blob:pending-full')
      expect(revokeObjectURL).not.toHaveBeenCalled()
    })

    it('hands the blob over to the queue on success (no double ownership)', () => {
      const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))
      act(() => {
        result.current.offerFullPageCapture('blob:pending-full', { page: 7 })
      })

      act(() => {
        result.current.confirmPendingFullPageAsDraft()
      })

      expect(result.current.pendingFullPageCapture).toBeNull()
      // Kuyruk URL'i üstlendi; yakalama hattı onu iptal etmemeli.
      expect(revokeObjectURL).not.toHaveBeenCalled()
    })
  })

  /**
   * Tek sahiplik: alan ve tam sayfa **aynı anda** bekleyemez.
   *
   * Aksi halde "hangi yakalama ekleniyor / gönderiliyor / temizleniyor?"
   * sorusunun tek ve deterministik yanıtı olmazdı: menü alan yakalamasını
   * gösterirken tam sayfa yakalamasının kaynağı ekranda görünmeden yaşar ve
   * sessizce sızar.
   */
  describe('single pending capture', () => {
    it('drops the area capture when a full-page capture arrives', async () => {
      const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

      await act(async () => {
        await result.current.handleCapture('blob:area', null)
      })
      expect(result.current.pendingAreaCapture?.dataUrl).toBe('blob:area')

      act(() => {
        result.current.offerFullPageCapture('blob:full', { page: 3 })
      })

      expect(result.current.pendingFullPageCapture?.dataUrl).toBe('blob:full')
      expect(result.current.pendingAreaCapture).toBeNull()
      // Düşürülen kaynak geri alınır: ekranda görünmeyen bir blob sızmaz.
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:area')
    })

    it('drops the full-page capture when a new area selection starts', async () => {
      const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

      act(() => {
        result.current.offerFullPageCapture('blob:full', { page: 3 })
      })

      act(() => {
        result.current.startScreenshot({ page: 4 })
      })

      expect(result.current.pendingFullPageCapture).toBeNull()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:full')
    })

    it('acts only on the surviving capture when the user confirms', async () => {
      const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

      await act(async () => {
        await result.current.handleCapture('blob:area', null)
      })
      act(() => {
        result.current.offerFullPageCapture('blob:full', { page: 3 })
      })

      // Artık yalnızca tam sayfa yakalaması geçerli.
      let confirmedArea: boolean | undefined
      let confirmedFull: boolean | undefined
      act(() => {
        confirmedArea = result.current.confirmPendingAreaAsDraft()
      })
      act(() => {
        confirmedFull = result.current.confirmPendingFullPageAsDraft()
      })

      expect(confirmedArea).toBe(false)
      expect(confirmedFull).toBe(true)
      // Kuyruğa yalnızca bir öğe, doğru kaynaktan yazılır.
      expect(queueImageForAi).toHaveBeenCalledTimes(1)
      expect(queueImageForAi).toHaveBeenCalledWith('blob:full', { page: 3 })
    })

    it('keeps at most one pending capture across several rounds', async () => {
      const { result } = renderHook(() => useScreenshotPipeline({ queueImageForAi }))

      await act(async () => {
        await result.current.handleCapture('blob:area-1', null)
      })
      act(() => {
        result.current.offerFullPageCapture('blob:full-1', { page: 1 })
      })
      await act(async () => {
        await result.current.handleCapture('blob:area-2', null)
      })

      expect(result.current.pendingFullPageCapture).toBeNull()
      expect(result.current.pendingAreaCapture?.dataUrl).toBe('blob:area-2')
    })
  })
})
