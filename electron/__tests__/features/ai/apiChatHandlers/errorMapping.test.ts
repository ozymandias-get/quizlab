import { describe, expect, it, vi } from 'vitest'

import { IPC_CHANNELS } from '../../../../../shared/constants/ipcChannels.js'

const registerIpcHandler = vi.fn()
const loadConfig = vi.fn()
const validateProviderUrl = vi.fn()
const fetchWithSsrProtection = vi.fn()
const sanitizeChatMessage = vi.fn()
const requireTrustedIpcSender = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: () => 'test-userdata' }
}))
vi.mock('../../../../core/typedIpcMain.js', () => ({ registerIpcHandler }))
vi.mock('../../../../core/ipcSecurity.js', () => ({ requireTrustedIpcSender }))
vi.mock('../../../../core/logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
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
    await import('../../../../features/ai/apiChatHandlers/apiChatHandlers.js')
  registerApiChatHandlers()
}

function seedConfig() {
  loadConfig.mockResolvedValue({
    providers: [{ id: 'p1', name: 'P1', baseUrl: 'https://api.example.com', apiKey: 'k' }],
    selectedProviderId: 'p1',
    generalPrompt: '',
    memoryPrompt: '',
    characterPrompt: ''
  })
  validateProviderUrl.mockReturnValue(null)
  sanitizeChatMessage.mockImplementation((m) => ({ role: m.role, content: m.content }))
}

describe('apiChatHandlers error mapping', () => {
  it('maps 401 to code "unauthorized" (not internal_error)', async () => {
    seedConfig()
    fetchWithSsrProtection.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API key'
    })

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, [
      { role: 'user', content: 'hello', id: 'm1', timestamp: 1 }
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
      expect(result.error.message).toMatch(/401/)
    }
  })

  it('labels 429 as rate limit instead of a generic error', async () => {
    seedConfig()
    fetchWithSsrProtection.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too many requests'
    })

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, [
      { role: 'user', content: 'hello', id: 'm1', timestamp: 1 }
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toMatch(/rate limit/i)
    }
  })

  it('rejects a 200 response with malformed body instead of empty success', async () => {
    seedConfig()
    fetchWithSsrProtection.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: 'weird envelope' })
    })

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, [
      { role: 'user', content: 'hello', id: 'm1', timestamp: 1 }
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toMatch(/invalid api response/i)
    }
  })

  it('rejects a non-array messages payload as invalid_input', async () => {
    seedConfig()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, 'not-an-array')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_input')
    }
  })
})
