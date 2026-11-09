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
    markQuitFlushComplete()

    await expect(pending).resolves.toBeUndefined()
  })

  it('does not block quitting when the renderer never answers', async () => {
    vi.useFakeTimers()
    const window = fakeWindow()
    const pending = waitForQuitFlush(window as never, 100)

    await vi.advanceTimersByTimeAsync(100)
    await expect(pending).resolves.toBeUndefined()
  })

  it('resolves immediately for a destroyed window', async () => {
    const window = { isDestroyed: () => true, webContents: { send: vi.fn() } }

    await expect(waitForQuitFlush(window as never)).resolves.toBeUndefined()
    expect(window.webContents.send).not.toHaveBeenCalled()
  })
})
