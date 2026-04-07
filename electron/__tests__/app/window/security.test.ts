import { beforeEach, describe, expect, it, vi } from 'vitest'

const shellOpenExternal = vi.fn()

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => '/mock-app')
  },
  shell: {
    openExternal: shellOpenExternal
  }
}))

describe('window/security', () => {
  beforeEach(() => {
    vi.resetModules()
    shellOpenExternal.mockReset()
  })

  it('accepts only safe external urls', async () => {
    const module = await import('../../../app/window/security')

    expect(module.isSafeExternalUrl('https://example.com')).toBe(true)
    expect(module.isSafeExternalUrl('http://localhost:5173')).toBe(true)
    expect(module.isSafeExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('opens external navigation and denies popup creation', async () => {
    const module = await import('../../../app/window/security')
    const setWindowOpenHandler = vi.fn()
    const listeners = new Map<string, (event: { preventDefault: () => void }, url: string) => void>()

    module.hardenWindowWebContents({
      webContents: {
        setWindowOpenHandler,
        on: (event: string, handler: (event: { preventDefault: () => void }, url: string) => void) =>
          listeners.set(event, handler)
      }
    } as never)

    const handler = setWindowOpenHandler.mock.calls[0][0]
    expect(handler({ url: 'https://example.com' })).toEqual({ action: 'deny' })

    const preventDefault = vi.fn()
    listeners.get('will-navigate')?.({ preventDefault }, 'https://example.com/docs')
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(shellOpenExternal).toHaveBeenCalledWith('https://example.com/docs')
  })
})
