import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMainWindow = vi.fn()
const isAllowedMainFrameUrl = vi.fn()

vi.mock('../../app/windowManager', () => ({
  getMainWindow
}))

vi.mock('../../app/window/security.js', () => ({
  isAllowedMainFrameUrl
}))

describe('ipcSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The URL policy itself is production code and is exercised for real in
    // electron/__tests__/app/window/security.test.ts. Here it stands in for
    // "the app document is still the loaded document".
    isAllowedMainFrameUrl.mockImplementation((url: string) => url.startsWith('file:///app/'))
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
})
