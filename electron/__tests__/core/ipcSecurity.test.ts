import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMainWindow = vi.fn()

vi.mock('../../app/windowManager', () => ({
  getMainWindow
}))

describe('ipcSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts trusted sender from main window with local origin', async () => {
    const trustedSender = { id: 1, getURL: () => 'file:///app/index.html' }
    getMainWindow.mockReturnValue({ webContents: trustedSender })

    const { requireTrustedIpcSender } = await import('../../core/ipcSecurity.js')
    const result = requireTrustedIpcSender({ sender: trustedSender } as never)

    expect(result).toBe(true)
  })

  it('rejects sender from main window that was redirected to an external origin', async () => {
    const compromisedSender = {
      id: 1,
      getURL: () => 'https://malicious-site.com/steal-data'
    }
    getMainWindow.mockReturnValue({ webContents: compromisedSender })

    const { requireTrustedIpcSender } = await import('../../core/ipcSecurity.js')
    const result = requireTrustedIpcSender({ sender: compromisedSender } as never)

    expect(result).toBe(false)
  })

  it('rejects non-main-window sender even with local origin', async () => {
    getMainWindow.mockReturnValue({
      webContents: { id: 1, getURL: () => 'file:///app/index.html' }
    })

    const { requireTrustedIpcSender } = await import('../../core/ipcSecurity.js')
    const result = requireTrustedIpcSender({
      sender: { id: 2, getURL: () => 'file:///app/index.html' }
    } as never)

    expect(result).toBe(false)
  })

  it('rejects crafted localhost subdomain (prefix-matching regression)', async () => {
    const evilSender = { id: 1, getURL: () => 'http://localhost.evil.com/steal' }
    getMainWindow.mockReturnValue({ webContents: evilSender })

    const { requireTrustedIpcSender } = await import('../../core/ipcSecurity.js')
    expect(requireTrustedIpcSender({ sender: evilSender } as never)).toBe(false)
  })

  it('accepts http://localhost with any port (dev server)', async () => {
    const devSender = { id: 1, getURL: () => 'http://localhost:5173/' }
    getMainWindow.mockReturnValue({ webContents: devSender })

    const { requireTrustedIpcSender } = await import('../../core/ipcSecurity.js')
    expect(requireTrustedIpcSender({ sender: devSender } as never)).toBe(true)
  })

  it('accepts http://127.0.0.1 with any port', async () => {
    const loopbackSender = { id: 1, getURL: () => 'http://127.0.0.1:5173/app' }
    getMainWindow.mockReturnValue({ webContents: loopbackSender })

    const { requireTrustedIpcSender } = await import('../../core/ipcSecurity.js')
    expect(requireTrustedIpcSender({ sender: loopbackSender } as never)).toBe(true)
  })
})
