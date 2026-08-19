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

  it('converts a synchronous handler throw into a structured failure instead of rejecting', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const handler = vi.fn().mockImplementation(() => {
      throw new Error('boom')
    })

    registerIpcHandler('test-channel' as any, handler)

    const wrappedHandler = mockHandle.mock.calls[0][1]
    const result = await wrappedHandler({} as any)
    expect(result).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'boom' }
    })
  })

  it('converts an async handler rejection into a structured failure instead of rejecting', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const handler = vi.fn().mockRejectedValue(new Error('async boom'))

    registerIpcHandler('test-channel' as any, handler)

    const wrappedHandler = mockHandle.mock.calls[0][1]
    const result = await wrappedHandler({} as any)
    expect(result).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'async boom' }
    })
  })

  it('converts non-Error throws (string, plain object) into a serializable failure', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const stringHandler = vi.fn().mockImplementation(() => {
      throw 'plain string'
    })
    const objectHandler = vi.fn().mockImplementation(() => {
      throw { some: 'value' }
    })

    registerIpcHandler('string-channel' as any, stringHandler)
    const stringResult = await mockHandle.mock.calls[0][1]({} as any)
    expect(stringResult).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'plain string' }
    })

    registerIpcHandler('object-channel' as any, objectHandler)
    const objectResult = await mockHandle.mock.calls[1][1]({} as any)
    expect(objectResult).toEqual({
      ok: false,
      error: { code: 'internal_error', message: '{"some":"value"}' }
    })
  })

  it('converts a trustedCheck throw into a structured failure', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const handler = vi.fn().mockResolvedValue('result')
    const trustedCheck = vi.fn().mockImplementation(() => {
      throw new Error('check failed')
    })

    registerIpcHandler('test-channel' as any, handler, trustedCheck, 'fallback')

    const wrappedHandler = mockHandle.mock.calls[0][1]
    const result = await wrappedHandler({} as any)
    expect(result).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'check failed' }
    })
    expect(handler).not.toHaveBeenCalled()
  })
})
