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

function textItem(id: string, t: string): AiDraftItem {
  return { id, type: 'text', text: t }
}

function imageItem(id: string, dataUrl: string): AiDraftItem {
  return { id, type: 'image', dataUrl }
}

/** Sayfa kaynağı taşıyan görsel — gövdedeki "Sayfa N/59" başlıkları bunu üretir. */
function imageItemAt(id: string, page: number): AiDraftItem {
  return {
    id,
    type: 'image',
    dataUrl: 'data:image/png;base64,AAA',
    source: { docId: 'doc', page, totalPages: 59, captureKind: 'area-image', createdAt: 1 }
  }
}

describe('useDraftSendOrchestration', () => {
  const buildHarness = (initial: AiDraftItem[] = [], providerId = 'chatgpt') => {
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

    return { result, sendTextToAI, sendBulkToAI, pendingAiItemsRef, setPendingAiItems }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when queue is empty', async () => {
    const { result, sendTextToAI, setPendingAiItems } = buildHarness()

    let res: any
    await act(async () => {
      res = await result.current.sendPendingAiItems()
    })

    expect(res).toEqual({ success: false, error: 'invalid_input' })
    expect(sendTextToAI).not.toHaveBeenCalled()
    expect(setPendingAiItems).not.toHaveBeenCalled()
  })

  it('sends a text-only draft as a single message with the merged prompt', async () => {
    const { result, sendTextToAI, setPendingAiItems } = buildHarness([textItem('t1', 'a')])

    let res: any
    await act(async () => {
      res = await result.current.sendPendingAiItems({ promptText: 'note' })
    })

    expect(res.success).toBe(true)
    expect(sendTextToAI).toHaveBeenCalledWith('note\n\na', { autoSend: true })
    expect(setPendingAiItems).toHaveBeenCalledWith(expect.any(Function))
  })

  it('sends an image draft through the single-message bulk path', async () => {
    const { result, sendBulkToAI } = buildHarness([imageItem('i1', 'data:image/png;base64,xxx')])

    let res: any
    await act(async () => {
      res = await result.current.sendPendingAiItems({ promptText: 'note' })
    })

    expect(res.success).toBe(true)
    expect(sendBulkToAI).toHaveBeenCalledWith(['data:image/png;base64,xxx'], {
      autoSend: true,
      promptText: 'note'
    })
  })

  // ── Tek mesaj sözleşmesi: çoklu görsel ve karışık kuyruk ────────────────
  // Görseller tek mesajın ekleri olur, prompt yalnızca bir kez yazılır ve
  // sağlayıcı taşıyamıyorsa sessizce bölünmez: taslak korunur.
  it('sends three images with a single bulk call and a single prompt', async () => {
    const { result, sendBulkToAI, sendTextToAI } = buildHarness([
      imageItemAt('i1', 11),
      imageItemAt('i2', 12),
      imageItemAt('i3', 13)
    ])

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Özetle' })
    })

    expect(sendBulkToAI).toHaveBeenCalledTimes(1)
    expect(sendTextToAI).not.toHaveBeenCalled()
    const [urls, opts] = sendBulkToAI.mock.calls[0]
    expect(urls).toHaveLength(3)
    // Prompt yalnızca bir kez.
    expect(opts.promptText).toContain('Özetle')
    expect(opts.promptText.match(/Özetle/g)).toHaveLength(1)
    // Sayfa bilgileri gövdede.
    expect(opts.promptText).toContain('Sayfa 11/59')
    expect(opts.promptText).toContain('Sayfa 12/59')
    expect(opts.promptText).toContain('Sayfa 13/59')
  })

  it('sends mixed text+image as one message (no per-image submit)', async () => {
    const { result, sendBulkToAI, sendTextToAI } = buildHarness([
      textItem('t1', 'A'),
      imageItemAt('i1', 13)
    ])

    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Note' })
    })

    expect(sendBulkToAI).toHaveBeenCalledTimes(1)
    expect(sendTextToAI).not.toHaveBeenCalled()
    const [urls] = sendBulkToAI.mock.calls[0]
    expect(urls).toHaveLength(1)
  })

  it('never splits into multiple messages for an unsupported provider', async () => {
    // Bilinmeyen/kullanıcı tanımlı sağlayıcı desteklenmiyor sayılır: gönderim
    // reddedilir, taslak korunur, sessiz çoklu mesaj ÜRETİLMEZ.
    const { result, sendBulkToAI, setPendingAiItems } = buildHarness(
      [imageItemAt('i1', 11), imageItemAt('i2', 12)],
      'my-custom-site'
    )

    let res: { success: boolean; error?: string } = { success: true }
    await act(async () => {
      res = await result.current.sendPendingAiItems()
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('bulk_not_supported')
    expect(sendBulkToAI).not.toHaveBeenCalled()
    expect(setPendingAiItems).not.toHaveBeenCalled()
  })

  it('single image needs no provider capability and sends as one message', async () => {
    const { result, sendBulkToAI } = buildHarness([imageItemAt('i1', 11)], 'my-custom-site')

    await act(async () => {
      await result.current.sendPendingAiItems()
    })

    expect(sendBulkToAI).toHaveBeenCalledTimes(1)
  })

  it('stops on failure and does not clear pending items', async () => {
    const { result, sendBulkToAI, setPendingAiItems } = buildHarness([
      imageItem('i1', 'data:image/png;base64,xxx')
    ])
    sendBulkToAI.mockResolvedValueOnce({ success: false, error: 'paste_failed' })

    let res: any
    await act(async () => {
      res = await result.current.sendPendingAiItems()
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('paste_failed')
    expect(setPendingAiItems).not.toHaveBeenCalled()
  })

  it('passes the per-call autoSend through to the sender', async () => {
    const { result, sendTextToAI } = buildHarness([textItem('t1', 'hi')])

    await act(async () => {
      await result.current.sendPendingAiItems({ autoSend: true })
    })

    expect(sendTextToAI).toHaveBeenCalledWith('hi', { autoSend: true })
  })

  // Regression: a forced send used to win over autoSend:false, so a disabled
  // preference still submitted.
  it('does not override an explicit autoSend:false', async () => {
    const { result, sendTextToAI } = buildHarness([textItem('t1', 'hi')])

    await act(async () => {
      await result.current.sendPendingAiItems({ autoSend: false })
    })

    expect(sendTextToAI).toHaveBeenCalledWith('hi', { autoSend: false })
  })

  it('prevents concurrent sends via the in-flight guard', async () => {
    const { result, sendTextToAI } = buildHarness([textItem('t1', 'a')])
    let resolveFirst!: (v: { success: boolean }) => void
    sendTextToAI.mockImplementationOnce(
      () => new Promise<{ success: boolean }>((resolve) => (resolveFirst = resolve))
    )

    let first: Promise<{ success: boolean }> = result.current.sendPendingAiItems()
    let second: { success: boolean; error?: string } = { success: true }
    await act(async () => {
      second = await result.current.sendPendingAiItems()
    })
    resolveFirst({ success: true })
    await act(async () => {
      await first
    })

    expect(second.error).toBe('send_in_progress')
  })

  it('keeps drafts queued when a send fails, then clears them on retry', async () => {
    const { result, sendTextToAI, setPendingAiItems } = buildHarness([textItem('t1', 'first')])
    sendTextToAI.mockResolvedValueOnce({ success: false, error: 'API error: 500' })

    let res: any
    await act(async () => {
      res = await result.current.sendPendingAiItems()
    })

    expect(res).toEqual({ success: false, error: 'API error: 500' })
    expect(setPendingAiItems).not.toHaveBeenCalled()

    sendTextToAI.mockResolvedValueOnce({ success: true })
    await act(async () => {
      res = await result.current.sendPendingAiItems()
    })

    expect(res.success).toBe(true)
    expect(setPendingAiItems).toHaveBeenCalledTimes(1)
    const updater = setPendingAiItems.mock.calls[0][0] as (current: AiDraftItem[]) => AiDraftItem[]
    expect(updater([textItem('t1', 'first')])).toEqual([])
  })

  it('propagates a staged (auto-send off) result without claiming delivery', async () => {
    const { result, sendTextToAI } = buildHarness([textItem('t1', 'hi')], 'chatgpt')
    sendTextToAI.mockResolvedValueOnce({ success: true, mode: 'staged' })

    let res: { success: boolean; mode?: string } = { success: false }
    await act(async () => {
      res = (await result.current.sendPendingAiItems({ autoSend: false })) as typeof res
    })

    expect(res.success).toBe(true)
    expect(res.mode).toBe('staged')
  })

  /**
   * Snapshot sınırı: gönderim **başındaki** kuyruk dizisini gönderir.
   * İşlem sürerken eklenen öğeler gönderilmez ve — daha önemlisi — kuyruktan
   * düşmez. "Gönderildi" dedikten sonra kullanıcının eklediği içerik kaybolursa
   * bu sessiz veri kaybıdır.
   */
  describe('items added during a send', () => {
    it('does not send an item queued after the send started', async () => {
      const snapshot = [textItem('t1', 'first')]
      const { result, sendTextToAI, pendingAiItemsRef } = buildHarness(snapshot)
      // Gönderim sürerken kullanıcı yeni bir öğe ekliyor.
      sendTextToAI.mockImplementationOnce(async () => {
        pendingAiItemsRef.current = [...snapshot, textItem('t2', 'second')]
        return { success: true }
      })

      await act(async () => {
        await result.current.sendPendingAiItems()
      })

      // Gönderilen içerik yalnızca başlangıç anındaki öğe.
      const sentText = sendTextToAI.mock.calls[0][0] as string
      expect(sentText).toBe('first')
      expect(sentText).not.toContain('second')
    })

    it('keeps the newly added item in the queue', async () => {
      const snapshot = [textItem('t1', 'first')]
      const { result, sendTextToAI, pendingAiItemsRef, setPendingAiItems } = buildHarness(snapshot)
      sendTextToAI.mockImplementationOnce(async () => {
        pendingAiItemsRef.current = [...snapshot, textItem('t2', 'second')]
        return { success: true }
      })

      await act(async () => {
        await result.current.sendPendingAiItems()
      })

      // Yalnızca gönderilen kimlik düşer; eklenen öğe korunur.
      const updater = setPendingAiItems.mock.calls[0][0] as (
        current: AiDraftItem[]
      ) => AiDraftItem[]
      const after = updater(pendingAiItemsRef.current)
      expect(after.map((item) => item.id)).toEqual(['t2'])
    })

    it('keeps everything queued when the send fails', async () => {
      const snapshot = [textItem('t1', 'first')]
      const { result, sendTextToAI, setPendingAiItems } = buildHarness(snapshot)
      sendTextToAI.mockResolvedValueOnce({ success: false, error: 'paste_failed' })

      await act(async () => {
        await result.current.sendPendingAiItems()
      })

      // Başarısızlıkta hiçbir öğe düşmez.
      expect(setPendingAiItems).not.toHaveBeenCalled()
    })
  })
})
