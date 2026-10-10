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
})
