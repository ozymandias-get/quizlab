import { confirmQuitWithPendingWrites } from '../../app/quitConfirmation.js'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const waitForQuitFlush = vi.hoisted(() => vi.fn())
const showMessageBox = vi.hoisted(() => vi.fn())

vi.mock('../../app/quitFlushGate.js', () => ({ waitForQuitFlush }))
vi.mock('electron', () => ({ dialog: { showMessageBox } }))
vi.mock('../../core/logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

function window() {
  return { isDestroyed: () => false }
}

describe('confirmQuitWithPendingWrites', () => {
  beforeEach(() => {
    waitForQuitFlush.mockReset()
    showMessageBox.mockReset()
  })

  it('closes without asking when the flush succeeded', async () => {
    waitForQuitFlush.mockResolvedValue(true)

    await expect(confirmQuitWithPendingWrites(window() as never)).resolves.toBe(true)
    expect(showMessageBox).not.toHaveBeenCalled()
  })

  it('retries until the write succeeds', async () => {
    waitForQuitFlush
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    showMessageBox.mockResolvedValueOnce({ response: 0 }).mockResolvedValueOnce({ response: 0 })

    await expect(confirmQuitWithPendingWrites(window() as never)).resolves.toBe(true)
    expect(waitForQuitFlush).toHaveBeenCalledTimes(3)
  })

  it('keeps asking when the retry fails again and the user cancels', async () => {
    waitForQuitFlush.mockResolvedValue(false)
    showMessageBox.mockResolvedValueOnce({ response: 0 }).mockResolvedValueOnce({ response: 2 })

    await expect(confirmQuitWithPendingWrites(window() as never)).resolves.toBe(false)
    expect(waitForQuitFlush).toHaveBeenCalledTimes(2)
  })

  it('allows an explicit quit without saving', async () => {
    waitForQuitFlush.mockResolvedValue(false)
    showMessageBox.mockResolvedValue({ response: 1 })

    await expect(confirmQuitWithPendingWrites(window() as never)).resolves.toBe(true)
  })

  it('does not ask when there is no window left', async () => {
    await expect(confirmQuitWithPendingWrites(null)).resolves.toBe(true)
    expect(waitForQuitFlush).not.toHaveBeenCalled()
  })

  it('shares one decision between a close and a quit request', async () => {
    let release!: (saved: boolean) => void
    waitForQuitFlush.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )
    showMessageBox.mockResolvedValue({ response: 2 })

    const close = confirmQuitWithPendingWrites(window() as never)
    const quit = confirmQuitWithPendingWrites(window() as never)
    await Promise.resolve()
    expect(waitForQuitFlush).toHaveBeenCalledTimes(1)

    release(false)
    await expect(Promise.all([close, quit])).resolves.toEqual([false, false])
    expect(showMessageBox).toHaveBeenCalledTimes(1)
  })

  it('does not quit with unsaved changes when the warning cannot be shown', async () => {
    waitForQuitFlush.mockResolvedValue(false)
    showMessageBox.mockRejectedValue(new Error('no display'))

    await expect(confirmQuitWithPendingWrites(window() as never)).resolves.toBe(false)
  })
})
