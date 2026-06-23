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
  const buildHarness = (initial: AiDraftItem[] = []) => {
    const sendTextToAI = vi.fn().mockResolvedValue({ success: true })
    const sendImageToAI = vi.fn().mockResolvedValue({ success: true })
    const pendingAiItemsRef: { current: AiDraftItem[] } = { current: initial }
    const setPendingAiItems = vi.fn()

    const { result } = renderHook(() =>
      useDraftSendOrchestration({
        autoSend: true,
        sendTextToAI,
        sendImageToAI,
        pendingAiItemsRef,
        setPendingAiItems
      })
    )

    return { result, sendTextToAI, sendImageToAI, pendingAiItemsRef, setPendingAiItems }
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

  it('dispatches text segments to sendTextToAI with merged prompt', async () => {
    const { result, sendTextToAI, setPendingAiItems } = buildHarness([textItem('t1', 'a')])

    let res: any
    await act(async () => {
      res = await result.current.sendPendingAiItems({ promptText: 'note' })
    })

    expect(res.success).toBe(true)
    expect(sendTextToAI).toHaveBeenCalledWith('note\n\na', { autoSend: true })
    expect(setPendingAiItems).toHaveBeenCalledWith(expect.any(Function))
  })

  it('dispatches image segments to sendImageToAI', async () => {
    const { result, sendImageToAI } = buildHarness([imageItem('i1', 'data:image/png;base64,xxx')])

    let res: any
    await act(async () => {
      res = await result.current.sendPendingAiItems({ promptText: 'note' })
    })

    expect(res.success).toBe(true)
    expect(sendImageToAI).toHaveBeenCalledWith('data:image/png;base64,xxx', {
      autoSend: true,
      promptText: 'note'
    })
  })

  it('stops at first failure and does not clear pending items', async () => {
    const { result, sendImageToAI, setPendingAiItems } = buildHarness([
      imageItem('i1', 'data:image/png;base64,xxx')
    ])
    sendImageToAI.mockResolvedValueOnce({ success: false, error: 'paste_failed' })

    let res: any
    await act(async () => {
      res = await result.current.sendPendingAiItems()
    })

    expect(res.success).toBe(false)
    expect(res.error).toBe('paste_failed')
    expect(setPendingAiItems).not.toHaveBeenCalled()
  })

  it('respects forceAutoSend over autoSend option', async () => {
    const { result, sendTextToAI } = buildHarness([textItem('t1', 'hi')])

    await act(async () => {
      await result.current.sendPendingAiItems({ autoSend: false, forceAutoSend: true })
    })

    expect(sendTextToAI).toHaveBeenCalledWith('hi', { autoSend: true })
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
})
