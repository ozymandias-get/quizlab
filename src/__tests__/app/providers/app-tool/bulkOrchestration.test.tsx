import type { AiDraftItem } from '@app/providers/ai/types'
import { useDraftSendOrchestration } from '@app/providers/app-tool/useDraftSendOrchestration'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn()
  })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}))

function textItem(id: string, t: string, page = 11): AiDraftItem {
  return {
    id,
    type: 'text',
    text: t,
    source: { docId: 'doc', page, totalPages: 59, captureKind: 'text-selection', createdAt: 1 }
  }
}

function imageItem(id: string, page = 13): AiDraftItem {
  return {
    id,
    type: 'image',
    dataUrl: 'data:image/png;base64,AAA',
    source: { docId: 'doc', page, totalPages: 59, captureKind: 'area-image', createdAt: 1 }
  }
}

describe('bulk orchestration (single message)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function buildHarness(initial: AiDraftItem[], providerId = 'chatgpt') {
    const sendTextToAI = vi.fn().mockResolvedValue({ success: true })
    const sendBulkToAI = vi.fn().mockResolvedValue({ success: true })
    const pendingAiItemsRef: { current: AiDraftItem[] } = { current: initial }
    const setPendingAiItems = vi.fn()
    const { result } = renderHook(() =>
      useDraftSendOrchestration({
        autoSend: true,
        providerId,
        sendTextToAI,
        sendBulkToAI,
        pendingAiItemsRef,
        setPendingAiItems
      })
    )
    return { result, sendTextToAI, sendBulkToAI, setPendingAiItems }
  }

  it('sends three images with a single bulk call and a single prompt', async () => {
    const { result, sendBulkToAI } = buildHarness([
      imageItem('i1', 11),
      imageItem('i2', 12),
      imageItem('i3', 13)
    ])
    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Özetle' })
    })
    expect(sendBulkToAI).toHaveBeenCalledTimes(1)
    const [urls, opts] = sendBulkToAI.mock.calls[0]
    expect(urls).toHaveLength(3)
    // Prompt yalnızca bir kez.
    expect(opts.promptText).toContain('Özetle')
    expect(opts.promptText.match(/Özetle/g)?.length).toBe(1)
    // Sayfa bilgileri gövdede.
    expect(opts.promptText).toContain('Sayfa 11/59')
    expect(opts.promptText).toContain('Sayfa 12/59')
    expect(opts.promptText).toContain('Sayfa 13/59')
  })

  it('sends mixed text+image as one message (no per-image submit)', async () => {
    const { result, sendBulkToAI, sendTextToAI } = buildHarness([
      textItem('t1', 'A', 11),
      imageItem('i1', 13)
    ])
    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Note' })
    })
    expect(sendBulkToAI).toHaveBeenCalledTimes(1)
    expect(sendTextToAI).not.toHaveBeenCalled()
  })

  it('keeps the draft on bulk failure (no silent split)', async () => {
    const { result, sendBulkToAI, setPendingAiItems } = buildHarness([imageItem('i1', 11)])
    sendBulkToAI.mockResolvedValueOnce({ success: false, error: 'paste_failed' })
    let res: unknown
    await act(async () => {
      res = await result.current.sendPendingAiItems()
    })
    expect((res as { success: boolean }).success).toBe(false)
    expect(setPendingAiItems).not.toHaveBeenCalled()
    expect(sendBulkToAI).toHaveBeenCalledTimes(1)
  })

  it('never splits into multiple messages for an unsupported provider', async () => {
    // Bilinmeyen/kullanıcı tanımlı sağlayıcı desteklenmiyor sayılır:
    // gönderim reddedilir, taslak korunur, sessiz çoklu mesaj ÜRETİLMEZ.
    const { result, sendBulkToAI, setPendingAiItems } = buildHarness(
      [imageItem('i1', 11), imageItem('i2', 12)],
      'my-custom-site'
    )
    let res: { success: boolean; error?: string } = { success: true }
    await act(async () => {
      res = (await result.current.sendPendingAiItems()) as typeof res
    })
    expect(res.success).toBe(false)
    expect(res.error).toBe('bulk_not_supported')
    expect(sendBulkToAI).not.toHaveBeenCalled()
    expect(setPendingAiItems).not.toHaveBeenCalled()
  })

  it('guards double submit', async () => {
    const { result, sendBulkToAI } = buildHarness([imageItem('i1', 11)])
    let resolveFirst!: (v: { success: boolean }) => void
    sendBulkToAI.mockImplementationOnce(
      () => new Promise<{ success: boolean }>((resolve) => (resolveFirst = resolve))
    )
    let first: Promise<unknown> = result.current.sendPendingAiItems()
    let second: { success: boolean; error?: string } = { success: true }
    await act(async () => {
      second = (await result.current.sendPendingAiItems()) as typeof second
    })
    resolveFirst({ success: true })
    await act(async () => {
      await first
    })
    expect(second.error).toBe('send_in_progress')
  })

  it('respects per-call autoSend:false for bulk', async () => {
    const { result, sendBulkToAI } = buildHarness([imageItem('i1', 11)])
    await act(async () => {
      await result.current.sendPendingAiItems({ autoSend: false })
    })
    expect(sendBulkToAI).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ autoSend: false })
    )
  })

  it('propagates a staged text result (auto-send off) instead of claiming delivery', async () => {
    const { result, sendTextToAI } = buildHarness([textItem('t1', 'A', 11)], 'chatgpt')
    sendTextToAI.mockResolvedValueOnce({ success: true, mode: 'staged' })
    let res: { success: boolean; mode?: string } = { success: false }
    await act(async () => {
      res = (await result.current.sendPendingAiItems({ autoSend: false })) as typeof res
    })
    expect(res.success).toBe(true)
    // Hazırlanan (staged) sonuç "gönderildi" (delivered) olarak dönmemeli.
    expect(res.mode).toBe('staged')
  })

  it('single image needs no provider capability and sends as one message', async () => {
    const { result, sendBulkToAI } = buildHarness([imageItem('i1', 11)], 'my-custom-site')
    await act(async () => {
      await result.current.sendPendingAiItems()
    })
    expect(sendBulkToAI).toHaveBeenCalledTimes(1)
  })

  /**
   * Gönderim başındaki snapshot ile işlem sırasında eklenen öğeler birbirine
   * karışmamalı: yeni öğe gönderilmez, kuyrukta kalır ve kullanıcının verisi
   * kaybolmaz.
   */
  describe('snapshot boundary', () => {
    function buildLiveHarness(initial: AiDraftItem[]) {
      const sendTextToAI = vi.fn().mockResolvedValue({ success: true })
      const sendBulkToAI = vi.fn().mockResolvedValue({ success: true })
      const pendingAiItemsRef: { current: AiDraftItem[] } = { current: initial }
      // Gerçek kuyruk davranışı: updater'ı anlık diziden hesapla.
      const setPendingAiItems = vi.fn(
        (action: AiDraftItem[] | ((prev: AiDraftItem[]) => AiDraftItem[])) => {
          const next = typeof action === 'function' ? action(pendingAiItemsRef.current) : action
          pendingAiItemsRef.current = next
        }
      )
      const { result } = renderHook(() =>
        useDraftSendOrchestration({
          autoSend: true,
          providerId: 'chatgpt',
          sendTextToAI,
          sendBulkToAI,
          pendingAiItemsRef,
          setPendingAiItems
        })
      )
      return { result, sendTextToAI, sendBulkToAI, pendingAiItemsRef }
    }

    it('does not send an item added while the send is running', async () => {
      const { result, pendingAiItemsRef, sendBulkToAI } = buildLiveHarness([imageItem('i1', 11)])

      let release!: (v: { success: boolean }) => void
      sendBulkToAI.mockImplementationOnce(
        () => new Promise<{ success: boolean }>((resolve) => (release = resolve))
      )

      let send!: Promise<unknown>
      act(() => {
        send = result.current.sendPendingAiItems()
      })
      // Gönderim sürerken kullanıcı yeni bir içerik ekliyor.
      act(() => {
        pendingAiItemsRef.current = [...pendingAiItemsRef.current, imageItem('i2', 12)]
      })

      await act(async () => {
        release({ success: true })
        await send
      })

      // Gönderimde yalnızca başlangıçtaki tek görsel vardı.
      expect(sendBulkToAI.mock.calls[0][0]).toHaveLength(1)
      // Yeni öğe gönderilmedi ama kaybolmadı: kuyrukta duruyor.
      expect(pendingAiItemsRef.current.map((i) => i.id)).toEqual(['i2'])
    })

    it('keeps items the user removed while the send was running', async () => {
      const { result, pendingAiItemsRef, sendBulkToAI } = buildLiveHarness([
        imageItem('i1', 11),
        imageItem('i2', 12)
      ])

      let release!: (v: { success: boolean }) => void
      sendBulkToAI.mockImplementationOnce(
        () => new Promise<{ success: boolean }>((resolve) => (release = resolve))
      )

      let send!: Promise<unknown>
      act(() => {
        send = result.current.sendPendingAiItems()
      })
      // Kullanıcı gönderim sürerken 2. öğeyi kaldırdı.
      act(() => {
        pendingAiItemsRef.current = [pendingAiItemsRef.current[0]]
      })

      await act(async () => {
        release({ success: true })
        await send
      })

      // Kaldırılan öğe "başarıyla gönderildi" diye kuyruktan düşmez; kalan öğe
      // gönderildiği için kuyruktan çıkar ve kuyruk boşalır.
      expect(pendingAiItemsRef.current).toEqual([])
    })

    it('keeps the whole draft when preparation fails mid-way', async () => {
      const { result, pendingAiItemsRef, sendBulkToAI } = buildLiveHarness([imageItem('i1', 11)])
      sendBulkToAI.mockResolvedValueOnce({ success: false, error: 'paste_failed' })

      await act(async () => {
        await result.current.sendPendingAiItems()
      })

      expect(pendingAiItemsRef.current.map((i) => i.id)).toEqual(['i1'])
    })

    it('refuses to send while another send is still running', async () => {
      const { result, sendBulkToAI } = buildLiveHarness([imageItem('i1', 11)])

      let release!: (v: { success: boolean }) => void
      sendBulkToAI.mockImplementationOnce(
        () => new Promise<{ success: boolean }>((resolve) => (release = resolve))
      )

      let first!: Promise<unknown>
      act(() => {
        first = result.current.sendPendingAiItems()
      })
      let second: { success: boolean; error?: string } = { success: true }
      await act(async () => {
        second = (await result.current.sendPendingAiItems()) as typeof second
      })
      expect(second.error).toBe('send_in_progress')
      expect(sendBulkToAI).toHaveBeenCalledTimes(1)

      await act(async () => {
        release({ success: true })
        await first
      })
    })
  })
})
