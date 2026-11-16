import { waitForQuitFlush, markQuitFlushComplete } from '../../app/quitFlushGate.js'
import { IPC_CHANNELS } from '../../../shared/constants/ipcChannels.js'

import { afterEach, describe, expect, it, vi } from 'vitest'

function fakeWindow() {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn() }
  }
}

function sentRequestId(window: ReturnType<typeof fakeWindow>): number {
  return window.webContents.send.mock.calls[0][1] as number
}

describe('the quit flush gate', () => {
  afterEach(() => {
    markQuitFlushComplete()
    vi.useRealTimers()
  })

  it('asks the renderer to flush and resolves on its answer', async () => {
    const window = fakeWindow()
    const pending = waitForQuitFlush(window as never)
    const requestId = sentRequestId(window)

    expect(window.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.APP_FLUSH_PENDING_STATE,
      requestId
    )
    markQuitFlushComplete(true, requestId)

    await expect(pending).resolves.toBe(true)
  })

  it('reports a failed renderer save', async () => {
    const window = fakeWindow()
    const pending = waitForQuitFlush(window as never)

    markQuitFlushComplete(false, sentRequestId(window))

    await expect(pending).resolves.toBe(false)
  })

  it('releases only the request the answer names', async () => {
    const first = fakeWindow()
    const second = fakeWindow()
    let firstSettled = false
    let secondSettled = false
    const firstWaiting = waitForQuitFlush(first as never).then((saved) => {
      firstSettled = true
      return saved
    })
    const secondWaiting = waitForQuitFlush(second as never).then((saved) => {
      secondSettled = true
      return saved
    })

    markQuitFlushComplete(true, sentRequestId(first))
    await Promise.resolve()

    expect(firstSettled).toBe(true)
    expect(secondSettled).toBe(false)

    markQuitFlushComplete(false, sentRequestId(second))
    await expect(firstWaiting).resolves.toBe(true)
    await expect(secondWaiting).resolves.toBe(false)
  })

  it('ignores a late answer from a request that already timed out', async () => {
    vi.useFakeTimers()
    const staleWindow = fakeWindow()
    const stale = waitForQuitFlush(staleWindow as never, 100)
    const staleId = sentRequestId(staleWindow)

    await vi.advanceTimersByTimeAsync(100)
    await expect(stale).resolves.toBe(false)

    const currentWindow = fakeWindow()
    let currentSettled = false
    const current = waitForQuitFlush(currentWindow as never, 1000).then((saved) => {
      currentSettled = true
      return saved
    })

    markQuitFlushComplete(true, staleId)
    await Promise.resolve()
    expect(currentSettled).toBe(false)

    markQuitFlushComplete(true, sentRequestId(currentWindow))
    await expect(current).resolves.toBe(true)
  })

  it('ignores an answer without a request id instead of releasing every waiter', async () => {
    const first = fakeWindow()
    const second = fakeWindow()
    let firstSettled = false
    let secondSettled = false
    const firstWaiting = waitForQuitFlush(first as never).then((saved) => {
      firstSettled = true
      return saved
    })
    const secondWaiting = waitForQuitFlush(second as never).then((saved) => {
      secondSettled = true
      return saved
    })

    // A stale renderer or an anonymous IPC answer must not complete a newer
    // flush it was never sent for.
    markQuitFlushComplete(true)
    await Promise.resolve()
    expect(firstSettled).toBe(false)
    expect(secondSettled).toBe(false)

    markQuitFlushComplete(true, sentRequestId(first))
    markQuitFlushComplete(true, sentRequestId(second))
    await expect(Promise.all([firstWaiting, secondWaiting])).resolves.toEqual([true, true])
  })

  it('does not block quitting when the renderer never answers', async () => {
    vi.useFakeTimers()
    const window = fakeWindow()
    const pending = waitForQuitFlush(window as never, 100)

    await vi.advanceTimersByTimeAsync(100)
    await expect(pending).resolves.toBe(false)
  })

  it('resolves immediately for a destroyed window', async () => {
    const window = { isDestroyed: () => true, webContents: { send: vi.fn() } }

    await expect(waitForQuitFlush(window as never)).resolves.toBe(false)
    expect(window.webContents.send).not.toHaveBeenCalled()
  })
})
