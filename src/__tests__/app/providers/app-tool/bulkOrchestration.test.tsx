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

  function buildHarness(initial: AiDraftItem[]) {
    const sendTextToAI = vi.fn().mockResolvedValue({ success: true })
    const sendImageToAI = vi.fn().mockResolvedValue({ success: true })
    const sendBulkToAI = vi.fn().mockResolvedValue({ success: true })
    const pendingAiItemsRef: { current: AiDraftItem[] } = { current: initial }
    const setPendingAiItems = vi.fn()
    const { result } = renderHook(() =>
      useDraftSendOrchestration({
        autoSend: true,
        sendTextToAI,
        sendImageToAI,
        sendBulkToAI,
        pendingAiItemsRef,
        setPendingAiItems
      })
    )
    return { result, sendTextToAI, sendImageToAI, sendBulkToAI, setPendingAiItems }
  }

  it('sends three images with a single bulk call and a single prompt', async () => {
    const { result, sendBulkToAI, sendImageToAI } = buildHarness([
      imageItem('i1', 11),
      imageItem('i2', 12),
      imageItem('i3', 13)
    ])
    await act(async () => {
      await result.current.sendPendingAiItems({ promptText: 'Özetle' })
    })
    expect(sendBulkToAI).toHaveBeenCalledTimes(1)
    expect(sendImageToAI).not.toHaveBeenCalled()
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
})
