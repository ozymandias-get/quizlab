import { describe, expect, it, vi } from 'vitest'

import { IPC_CHANNELS } from '../../../../../shared/constants/ipc-channels.js'

const registerIpcHandler = vi.fn()
const loadConfig = vi.fn()
const validateProviderUrl = vi.fn()
const fetchWithSsrProtection = vi.fn()
const sanitizeChatMessage = vi.fn()
const requireTrustedIpcSender = vi.fn()
const loggerWarn = vi.fn()
const loggerInfo = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: () => 'test-userdata' }
}))
vi.mock('../../../../core/typedIpcMain.js', () => ({ registerIpcHandler }))
vi.mock('../../../../core/ipcSecurity.js', () => ({ requireTrustedIpcSender }))
vi.mock('../../../../core/logger.js', () => ({
  Logger: { info: loggerInfo, warn: loggerWarn, error: vi.fn() }
}))
vi.mock('../../../../features/ai/apiChatHandlers/config.js', () => ({
  loadConfig,
  saveConfig: vi.fn(),
  sanitizeApiKey: (k: string) => k
}))
vi.mock('../../../../features/ai/apiChatHandlers/ssrf.js', () => ({
  fetchWithSsrProtection,
  validateProviderUrl
}))
vi.mock('../../../../features/ai/apiChatHandlers/validation.js', () => ({
  MAX_REQUEST_BODY_SIZE: 1024 * 1024 * 8,
  sanitizeChatMessage
}))

function getHandler(channel: string) {
  return registerIpcHandler.mock.calls.find(([c]) => c === channel)?.[1]
}

async function main(): Promise<void> {
  const { registerApiChatHandlers } =
    await import('../../../../features/ai/apiChatHandlers/handlers.js')
  registerApiChatHandlers()
}

describe('apiChatHandlers abort semantics', () => {
  it('reports user cancellation with code "cancelled" (not timeout)', async () => {
    loadConfig.mockResolvedValue({
      providers: [{ id: 'p1', name: 'P1', baseUrl: 'https://api.example.com', apiKey: '' }],
      selectedProviderId: 'p1',
      generalPrompt: '',
      memoryPrompt: '',
      characterPrompt: ''
    })
    validateProviderUrl.mockReturnValue(null)
    sanitizeChatMessage.mockImplementation((m) => ({ role: m.role, content: m.content }))

    // Simulate a real in-flight HTTP stream that only settles on abort.
    let capturedSignal: AbortSignal | null = null
    fetchWithSsrProtection.mockImplementation((_url, opts: { signal: AbortSignal }) => {
      capturedSignal = opts.signal
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    })

    await main()

    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const cancelHandler = getHandler(IPC_CHANNELS.CANCEL_API_CHAT_REQUEST)

    const sendPromise = sendHandler({ sender: {} }, [
      { role: 'user', content: 'hello', id: 'm1', timestamp: 1 }
    ])
    await vi.waitFor(() => expect(capturedSignal).not.toBeNull())

    expect(await cancelHandler({ sender: {} })).toEqual({ ok: true, data: true })

    const result = await sendPromise
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('cancelled')
      expect(result.error.message).toMatch(/cancel/i)
    }
  })

  it('reports a provider timeout with the timeout message', async () => {
    loadConfig.mockResolvedValue({
      providers: [
        {
          id: 'p1',
          name: 'P1',
          baseUrl: 'https://api.example.com',
          apiKey: '',
          requestTimeout: 50
        }
      ],
      selectedProviderId: 'p1',
      generalPrompt: '',
      memoryPrompt: '',
      characterPrompt: ''
    })
    validateProviderUrl.mockReturnValue(null)
    sanitizeChatMessage.mockImplementation((m) => ({ role: m.role, content: m.content }))

    fetchWithSsrProtection.mockImplementation((_url, opts: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    })

    await main()

    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, [
      { role: 'user', content: 'hello', id: 'm1', timestamp: 1 }
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('internal_error')
      expect(result.error.message).toMatch(/timed out/i)
    }
  })

  it('does NOT abort a concurrent second request (per-requestId cancellation)', async () => {
    loadConfig.mockResolvedValue({
      providers: [{ id: 'p1', name: 'P1', baseUrl: 'https://api.example.com', apiKey: '' }],
      selectedProviderId: 'p1',
      generalPrompt: '',
      memoryPrompt: '',
      characterPrompt: ''
    })
    validateProviderUrl.mockReturnValue(null)
    sanitizeChatMessage.mockImplementation((m) => ({ role: m.role, content: m.content }))

    // Each send parks on a manually-resolvable promise that rejects on abort,
    // so the test controls completion order and can inspect both AbortSignals.
    const signals: AbortSignal[] = []
    const resolvers: Array<(value: Response) => void> = []
    const okResponse = (): Response =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
    fetchWithSsrProtection.mockImplementation((_url, opts: { signal: AbortSignal }) => {
      signals.push(opts.signal)
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          const abortError = new Error('The operation was aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        }
        opts.signal.addEventListener('abort', onAbort, { once: true })
        resolvers.push((value) => {
          opts.signal.removeEventListener('abort', onAbort)
          resolve(value)
        })
      })
    })

    await main()

    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const cancelHandler = getHandler(IPC_CHANNELS.CANCEL_API_CHAT_REQUEST)
    const message = [{ role: 'user', content: 'hello', id: 'm1', timestamp: 1 }]

    const first = sendHandler({ sender: {} }, message, undefined, undefined, undefined, 'req-first')
    await vi.waitFor(() => expect(signals.length).toBe(1))

    // A second tab sends while the first request is still in flight.
    const second = sendHandler(
      { sender: {} },
      message,
      undefined,
      undefined,
      undefined,
      'req-second'
    )
    await vi.waitFor(() => expect(signals.length).toBe(2))

    expect(signals[0].aborted).toBe(false)

    expect(await cancelHandler({ sender: {} }, 'req-first')).toEqual({ ok: true, data: true })

    // Only the targeted request is aborted; the concurrent one keeps running.
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)

    resolvers[1](okResponse())
    const secondResult = await second
    expect(secondResult.ok).toBe(true)

    const firstResult = await first
    expect(firstResult.ok).toBe(false)
    if (!firstResult.ok) {
      expect(firstResult.error.code).toBe('cancelled')
    }
    if (!firstResult.ok) {
      expect(firstResult.error.code).toBe('cancelled')
    }

    // Cancelling an unknown id reports false instead of throwing.
    expect(await cancelHandler({ sender: {} }, 'req-unknown')).toEqual({ ok: true, data: false })
  })
})
