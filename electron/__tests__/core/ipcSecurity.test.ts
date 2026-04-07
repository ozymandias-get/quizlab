import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMainWindow = vi.fn()

vi.mock('../../app/windowManager', () => ({
  getMainWindow
}))

describe('ipcSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts trusted sender from main window', async () => {
    const trustedSender = { id: 1 }
    getMainWindow.mockReturnValue({ webContents: trustedSender })

    const { requireTrustedIpcSender } = await import('../../core/ipcSecurity.js')
    const result = requireTrustedIpcSender({ sender: trustedSender, type: 'invoke' } as never)

    expect(result).toBe(true)
  })

  it('rejects non-main-window sender', async () => {
    getMainWindow.mockReturnValue({ webContents: { id: 1 } })

    const { requireTrustedIpcSender } = await import('../../core/ipcSecurity.js')
    const result = requireTrustedIpcSender({ sender: { id: 2 }, type: 'invoke' } as never)

    expect(result).toBe(false)
  })
})
