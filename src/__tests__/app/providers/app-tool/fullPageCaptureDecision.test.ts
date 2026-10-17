import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useScreenshotPipeline } from '@app/providers/app-tool/useScreenshotPipeline'

vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
  useScreenshot: (onSendToAI?: (data: string, rect: unknown) => Promise<unknown>) => ({
    isScreenshotMode: false,
    startScreenshot: vi.fn(),
    closeScreenshot: vi.fn(),
    handleCapture: async (data: string, rect: unknown) => onSendToAI?.(data, rect)
  })
}))

const revokeObjectURL = vi.fn()

describe('useScreenshotPipeline — full-page capture decision', () => {
  const queueImageForAi = vi.fn(() => true)
  const queueTextForAi = vi.fn(() => true)

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL
    })
  })

  function setup() {
    return renderHook(() => useScreenshotPipeline({ queueImageForAi, queueTextForAi }))
  }

  it('parks a full-page capture for the choice menu instead of queueing it', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-13', {
        page: 13,
        captureKind: 'full-page',
        source: {
          docId: 'doc',
          page: 13,
          totalPages: 59,
          captureKind: 'full-page-image',
          createdAt: 1
        }
      })
    })

    // Kendiliğinden taslağa EKLENMEZ.
    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(result.current.pendingFullPageCapture).not.toBeNull()
    expect(result.current.pendingFullPageCapture?.dataUrl).toBe('blob:page-13')
    expect(result.current.pendingFullPageCapture?.meta?.page).toBe(13)
  })

  it('queues the capture only after the user picks "Taslağa Ekle"', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-13', { page: 13, captureKind: 'full-page' })
    })
    act(() => {
      result.current.confirmPendingFullPageAsDraft()
    })

    expect(queueImageForAi).toHaveBeenCalledWith(
      'blob:page-13',
      expect.objectContaining({ page: 13, captureKind: 'full-page' })
    )
    expect(result.current.pendingFullPageCapture).toBeNull()
  })

  // ── Tam sayfa metni: görsellerle AYNI sözleşme ──────────────────────────
  // Öncesi: "Bu Sayfanın Metnini AI'ye Ekle" doğrudan `queueTextForAi` çağırıyordu;
  // kullanıcının yalnızca "Taslağa Ekle" seçeneği vardı ve görsel yolun menüsüyle
  // tutarsızdı.
  it('parks page text for the choice menu instead of queueing it', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageText('sayfa metni', {
        source: {
          docId: 'doc',
          page: 13,
          totalPages: 59,
          captureKind: 'full-page-text',
          createdAt: 1
        }
      })
    })

    expect(queueTextForAi).not.toHaveBeenCalled()
    expect(result.current.pendingFullPageTextCapture?.text).toBe('sayfa metni')
    expect(result.current.pendingFullPageTextCapture?.meta?.source?.page).toBe(13)
  })

  it('queues the text only after the user picks "Taslağa Ekle"', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageText('sayfa metni', null)
    })
    act(() => {
      result.current.confirmPendingFullPageTextAsDraft()
    })

    expect(queueTextForAi).toHaveBeenCalledWith('sayfa metni', null, undefined)
    expect(result.current.pendingFullPageTextCapture).toBeNull()
  })

  it('keeps the text pending when the queue rejects it, so the content is never lost', () => {
    // Görsellerle aynı sözleşme: kuyruk yalnız kabul ederse sahiplik devreder.
    // Reddedilirse kullanıcı elemanlarını azaltıp yeniden deneyebilir.
    queueTextForAi.mockReturnValueOnce(false)
    const { result } = setup()

    act(() => {
      result.current.offerFullPageText('sayfa metni', null)
    })
    let accepted = true
    act(() => {
      accepted = result.current.confirmPendingFullPageTextAsDraft()
    })

    expect(accepted).toBe(false)
    expect(result.current.pendingFullPageTextCapture?.text).toBe('sayfa metni')
  })

  it('never opens a menu for empty page text', () => {
    // Çıkarım başarısız olduğunda `onNoTextFound` uyarısı zaten gösteriliyor;
    // boş bir yakalama menü açmak yanıltıcı olurdu.
    const { result } = setup()

    act(() => {
      result.current.offerFullPageText('   ', null)
    })

    expect(result.current.pendingFullPageTextCapture).toBeNull()
  })

  it('enforces single ownership: page text supersedes a pending image capture', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-13', { page: 13, captureKind: 'full-page' })
    })
    act(() => {
      result.current.offerFullPageText('sayfa metni', null)
    })

    expect(result.current.pendingFullPageCapture).toBeNull()
    expect(result.current.pendingFullPageTextCapture?.text).toBe('sayfa metni')
    // Görsel kaynağı iptal edilir (blob sızmasın).
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:page-13')
  })

  it('enforces single ownership the other way: a new image capture supersedes pending text', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageText('sayfa metni', null)
    })
    act(() => {
      result.current.offerFullPageCapture('blob:page-13', { page: 13, captureKind: 'full-page' })
    })

    expect(result.current.pendingFullPageTextCapture).toBeNull()
    expect(result.current.pendingFullPageCapture?.dataUrl).toBe('blob:page-13')
  })

  it('revokes a dismissed capture and never queues it', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-13', { page: 13, captureKind: 'full-page' })
    })
    act(() => {
      result.current.dismissPendingFullPage()
    })

    expect(queueImageForAi).not.toHaveBeenCalled()
    expect(result.current.pendingFullPageCapture).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:page-13')
  })

  it('revokes the previous pending capture when a newer one supersedes it', () => {
    const { result } = setup()

    act(() => {
      result.current.offerFullPageCapture('blob:page-11', { page: 11, captureKind: 'full-page' })
    })
    act(() => {
      result.current.offerFullPageCapture('blob:page-12', { page: 12, captureKind: 'full-page' })
    })

    expect(result.current.pendingFullPageCapture?.dataUrl).toBe('blob:page-12')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:page-11')
    expect(queueImageForAi).not.toHaveBeenCalled()
  })
})
