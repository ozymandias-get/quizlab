/**
 * Regression tests for scheduleApiChatSend dangling-promise bug (P1).
 *
 * Two rapid calls within the debounce window used to clear the first timer
 * without settling its promise, leaving the caller hanging forever.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFlush = vi.fn()

vi.mock('@app/providers/ai/lib/apiChatSend', async () => {
  // Import real module then override flushApiChatSend with our mock so the
  // debounce logic itself is exercised.
  const real = await vi.importActual<typeof import('@app/providers/ai/lib/apiChatSend')>(
    '@app/providers/ai/lib/apiChatSend'
  )
  // Keep schedule/cancel from real; flush is the mockable boundary.
  return {
    ...real
    // We patch flushApiChatSend at the call site by re-exporting a wrapper
    // the test can observe. Simpler: spy on the imported flush via mock
    // indirection — reuse the real schedule implementation which calls the
    // real flush; we instead test schedule's promise-settling behaviour by
    // mocking the underlying sendApiChatMessage layer.
  }
})

// Instead of mocking inside the module, test the observable fix: no promise
// hangs when two callers race inside the 50ms window.
import { cancelScheduledApiChatSends, scheduleApiChatSend } from '@app/providers/ai/lib/apiChatSend'

vi.mock('@features/ai/queries/useSendMessageMutation', () => ({
  sendApiChatMessage: (..._args: unknown[]) => mockFlush(..._args)
}))

vi.mock('@features/ai/store/chatUiStore', () => ({
  useChatUiStore: {
    getState: () => ({
      inputValueByTab: { tab1: 'hello', tab2: 'world' },
      attachmentsByTab: {},
      selectedModelByTab: {},
      activeProviderByTab: {}
    })
  }
}))

describe('scheduleApiChatSend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFlush.mockResolvedValue({ success: true })
  })

  it('settles every caller when two calls race inside the debounce window', async () => {
    const ref: { current: ReturnType<typeof setTimeout> | null } = { current: null }

    const p1 = scheduleApiChatSend('tab1', ref)
    const p2 = scheduleApiChatSend('tab2', ref)

    // p1 must NOT hang — both promises settle after the single debounce.
    const [r1, r2] = await Promise.all([p1, p2])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    // Both tabs are flushed (grouped per tab).
    expect(mockFlush).toHaveBeenCalledTimes(2)
  })

  it('settles the first caller when superseded by a later call for the same tab', async () => {
    const ref: { current: ReturnType<typeof setTimeout> | null } = { current: null }

    const p1 = scheduleApiChatSend('tab1', ref)
    // Supersede before the timer fires (still same tab — one flush).
    const p2 = scheduleApiChatSend('tab1', ref)

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    // Same tab → bundled into one request.
    expect(mockFlush).toHaveBeenCalledTimes(1)
  })

  it('cancelScheduledApiChatSends settles pending promises with cancelled', async () => {
    const ref: { current: ReturnType<typeof setTimeout> | null } = { current: null }

    const p1 = scheduleApiChatSend('tab1', ref)
    cancelScheduledApiChatSends(ref)

    const r1 = await p1
    expect(r1.success).toBe(false)
    expect(r1.error).toBe('cancelled')
    expect(mockFlush).not.toHaveBeenCalled()
  })
})
