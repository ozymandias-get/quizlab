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

  it('registers on the given channel and forwards the event and arguments to the handler', async () => {
    const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
    const handler = vi.fn().mockResolvedValue('hello')

    registerIpcHandler('test-channel' as any, handler)

    expect(mockHandle).toHaveBeenCalledWith('test-channel', expect.any(Function))

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

  it.each([
    [
      'a synchronous throw',
      () => {
        throw new Error('boom')
      },
      'boom'
    ],
    ['an async rejection', () => Promise.reject(new Error('async boom')), 'async boom'],
    [
      'a non-Error string throw',
      () => {
        throw 'plain string'
      },
      'plain string'
    ],
    [
      'a non-Error object throw',
      () => {
        throw { some: 'value' }
      },
      '{"some":"value"}'
    ]
  ])(
    'converts %s into a structured failure instead of rejecting',
    async (_label, impl, message) => {
      const { registerIpcHandler } = await import('../../core/typedIpcMain.js')
      const handler = vi.fn().mockImplementation(impl as () => never)

      registerIpcHandler('test-channel' as any, handler)

      const wrappedHandler = mockHandle.mock.calls[mockHandle.mock.calls.length - 1][1]
      const result = await wrappedHandler({} as any)
      expect(result).toEqual({
        ok: false,
        error: { code: 'internal_error', message }
      })
    }
  )

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
