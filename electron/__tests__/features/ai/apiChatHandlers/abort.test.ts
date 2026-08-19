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
})
