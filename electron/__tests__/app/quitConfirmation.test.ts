import { confirmPendingWrites, confirmQuitWithPendingWrites } from '../../app/quitConfirmation.js'

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

  it('offers Cancel / Reload without saving for a reload', async () => {
    waitForQuitFlush.mockResolvedValue(false)
    showMessageBox.mockResolvedValue({ response: 1 })

    await expect(confirmPendingWrites(window() as never, 'reload')).resolves.toBe(true)
    expect(showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ buttons: ['Cancel', 'Reload without saving'] })
    )
  })

  it('shares one flush decision between a reload and a close', async () => {
    let release!: (saved: boolean) => void
    waitForQuitFlush.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )
    // The close supersedes the reload, so the dialog uses close's buttons:
    // 2 = Cancel. (0 would mean Retry and loop.)
    showMessageBox.mockResolvedValue({ response: 2 })

    const reload = confirmPendingWrites(window() as never, 'reload')
    const close = confirmPendingWrites(window() as never, 'close')
    await Promise.resolve()
    expect(waitForQuitFlush).toHaveBeenCalledTimes(1)

    release(false)
    await expect(Promise.all([reload, close])).resolves.toEqual([false, false])
    expect(showMessageBox).toHaveBeenCalledTimes(1)
  })

  it('gives an approved flush only to the latest overlapping caller', async () => {
    let release!: (saved: boolean) => void
    waitForQuitFlush.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )

    const reload = confirmPendingWrites(window() as never, 'reload')
    const close = confirmPendingWrites(window() as never, 'close')
    await Promise.resolve()
    release(true)

    await expect(Promise.all([reload, close])).resolves.toEqual([false, true])
  })

  it('hands the decision back when the later caller is the reload', async () => {
    let release!: (saved: boolean) => void
    waitForQuitFlush.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )

    const close = confirmPendingWrites(window() as never, 'close')
    const reload = confirmPendingWrites(window() as never, 'reload')
    await Promise.resolve()
    release(true)

    await expect(Promise.all([close, reload])).resolves.toEqual([false, true])
  })

  it('distinguishes two different requests of the same action type', async () => {
    let release!: (saved: boolean) => void
    waitForQuitFlush.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )

    const reloadA = confirmPendingWrites(window() as never, 'reload')
    const close = confirmPendingWrites(window() as never, 'close')
    const reloadB = confirmPendingWrites(window() as never, 'reload')
    await Promise.resolve()
    release(true)

    await expect(Promise.all([reloadA, close, reloadB])).resolves.toEqual([false, false, true])
  })

  it("shows the latest action's dialog when the shared flush fails", async () => {
    let release!: (saved: boolean) => void
    waitForQuitFlush.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )
    showMessageBox.mockResolvedValue({ response: 1 })

    const reload = confirmPendingWrites(window() as never, 'reload')
    const close = confirmPendingWrites(window() as never, 'close')
    await Promise.resolve()
    release(false)

    await vi.waitFor(() => expect(showMessageBox).toHaveBeenCalledTimes(1))
    expect(showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ buttons: ['Retry', 'Close without saving', 'Cancel'] })
    )
    await expect(Promise.all([reload, close])).resolves.toEqual([false, true])
  })

  it('keeps consent tied to the action named in the dialog', async () => {
    let releaseFlush!: (saved: boolean) => void
    let releaseDialog!: (value: { response: number }) => void
    waitForQuitFlush.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          releaseFlush = resolve
        })
    )
    showMessageBox.mockImplementation(
      () =>
        new Promise<{ response: number }>((resolve) => {
          releaseDialog = resolve
        })
    )

    const reload = confirmPendingWrites(window() as never, 'reload')
    await Promise.resolve()
    releaseFlush(false)
    await vi.waitFor(() => expect(showMessageBox).toHaveBeenCalledTimes(1))

    // A quit joins while the "Reload without saving" dialog is still open.
    const quit = confirmQuitWithPendingWrites(window() as never)
    releaseDialog({ response: 1 })

    await expect(Promise.all([reload, quit])).resolves.toEqual([true, false])
  })

  it('does not quit with unsaved changes when the warning cannot be shown', async () => {
    waitForQuitFlush.mockResolvedValue(false)
    showMessageBox.mockRejectedValue(new Error('no display'))

    await expect(confirmQuitWithPendingWrites(window() as never)).resolves.toBe(false)
  })
})
