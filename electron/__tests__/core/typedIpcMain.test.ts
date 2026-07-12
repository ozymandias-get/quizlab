import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockHandle = vi.fn()

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockHandle
  }
}))

describe('registerIpcHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('registers an IPC handler on the given channel', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const handler = vi.fn().mockResolvedValue('result')

    registerIpcHandler('test-channel' as any, handler)

    expect(mockHandle).toHaveBeenCalledWith('test-channel', expect.any(Function))
  })

  it('calls the handler and returns its result', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const handler = vi.fn().mockResolvedValue('hello')

    registerIpcHandler('test-channel' as any, handler)

    const wrappedHandler = mockHandle.mock.calls[0][1]
    const result = await wrappedHandler({} as any, 'arg1', 'arg2')
    expect(result).toBe('hello')
    expect(handler).toHaveBeenCalledWith(expect.any(Object), 'arg1', 'arg2')
  })

  it('skips handler when trustedCheck returns false', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const handler = vi.fn().mockResolvedValue('result')
    const trustedCheck = vi.fn().mockReturnValue(false)

    registerIpcHandler('test-channel' as any, handler, trustedCheck, 'fallback')

    const wrappedHandler = mockHandle.mock.calls[0][1]
    const result = await wrappedHandler({} as any, 'arg')
    expect(result).toBe('fallback')
    expect(handler).not.toHaveBeenCalled()
  })

  it('calls handler when trustedCheck returns true', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const handler = vi.fn().mockResolvedValue('result')
    const trustedCheck = vi.fn().mockReturnValue(true)

    registerIpcHandler('test-channel' as any, handler, trustedCheck, 'fallback')

    const wrappedHandler = mockHandle.mock.calls[0][1]
    const result = await wrappedHandler({} as any, 'arg')
    expect(result).toBe('result')
    expect(handler).toHaveBeenCalled()
  })
})
