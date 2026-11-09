import { waitForQuitFlush, markQuitFlushComplete } from '../../app/quitFlushGate.js'
import { IPC_CHANNELS } from '../../../shared/constants/ipcChannels.js'

import { afterEach, describe, expect, it, vi } from 'vitest'

function fakeWindow() {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn() }
  }
}

describe('the quit flush gate', () => {
  afterEach(() => {
    markQuitFlushComplete()
    vi.useRealTimers()
  })

  it('asks the renderer to flush and resolves on its answer', async () => {
    const window = fakeWindow()
    const pending = waitForQuitFlush(window as never)

    expect(window.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.APP_FLUSH_PENDING_STATE)
    markQuitFlushComplete(true)

    await expect(pending).resolves.toBe(true)
  })

  it('reports a failed renderer save', async () => {
    const window = fakeWindow()
    const pending = waitForQuitFlush(window as never)

    markQuitFlushComplete(false)

    await expect(pending).resolves.toBe(false)
  })

  it('releases every concurrent waiter with one renderer answer', async () => {
    const first = fakeWindow()
    const second = fakeWindow()
    const waiting = [waitForQuitFlush(first as never), waitForQuitFlush(second as never)]

    markQuitFlushComplete(true)

    await expect(Promise.all(waiting)).resolves.toEqual([true, true])
    expect(first.webContents.send).toHaveBeenCalledTimes(1)
    expect(second.webContents.send).toHaveBeenCalledTimes(1)
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
