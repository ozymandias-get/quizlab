import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IPC_CHANNELS } from '../../../../../shared/constants/ipcChannels.js'

/**
 * End-to-end coverage for the api-chat image path across the IPC boundary.
 *
 * Regression context: `sanitizeChatMessage` used to discard any turn whose text
 * was empty, which silently stripped the `images` payload. Every surface that
 * adds an image to a chat (the attachment button, "Send page as image to AI"
 * and the screenshot crop) produces a turn with images and no typed text, so
 * the provider never received the image even though the thumbnail was visible.
 *
 * These tests intentionally use the REAL validation module — mocking the
 * sanitizer would hide the very behaviour under test.
 */

const registerIpcHandler = vi.fn()
const loadConfig = vi.fn()
const validateProviderUrl = vi.fn()
const fetchWithSsrProtection = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: () => 'test-userdata' }
}))
vi.mock('../../../../core/typedIpcMain.js', () => ({ registerIpcHandler }))
vi.mock('../../../../core/ipcSecurity.js', () => ({ requireTrustedIpcSender: vi.fn() }))
vi.mock('../../../../core/logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('../../../../features/ai/apiChatHandlers/config.js', () => ({
  loadConfig,
  saveConfig: vi.fn(),
  sanitizeApiKey: (k: string) => k
}))
// Partial mock: only the two network-touching entry points are stubbed.
// Replacing the whole module meant every new export had to be added here by
// hand, and forgetting one turned into an undefined-function error at runtime
// rather than a type error.
vi.mock('../../../../features/ai/apiChatHandlers/ssrf.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../features/ai/apiChatHandlers/ssrf.js')>()),
  fetchWithSsrProtection,
  validateProviderUrl
}))

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

function getHandler(channel: string) {
  return registerIpcHandler.mock.calls.find(([c]) => c === channel)?.[1]
}

type SendBody = {
  model: string
  messages: Array<{ role: string; content: string | unknown[] }>
}

function sentBody(): SendBody {
  // `registerApiChatHandlers` is guarded against double registration, so the
  // handler table is shared for the whole file: read the most recent fetch.
  const init = fetchWithSsrProtection.mock.calls.at(-1)?.[1] as { body: string }
  return JSON.parse(init.body) as SendBody
}

async function main(): Promise<void> {
  const { registerApiChatHandlers } =
    await import('../../../../features/ai/apiChatHandlers/apiChatHandlers.js')
  registerApiChatHandlers()
}

function seedOkProvider() {
  loadConfig.mockResolvedValue({
    providers: [{ id: 'p1', name: 'P1', baseUrl: 'https://api.example.com', apiKey: 'k' }],
    selectedProviderId: 'p1',
    generalPrompt: '',
    memoryPrompt: '',
    characterPrompt: ''
  })
  validateProviderUrl.mockReturnValue(null)
  fetchWithSsrProtection.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'ok' } }] })
  })
}

beforeEach(() => {
  // Deliberately not `clearAllMocks`: that would wipe the shared
  // `registerIpcHandler` table that `getHandler` reads from.
  loadConfig.mockReset()
  validateProviderUrl.mockReset()
  fetchWithSsrProtection.mockReset()
})

describe('api-chat image forwarding', () => {
  it('sends an image-only turn to the provider instead of rejecting it', async () => {
    seedOkProvider()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, [
      { id: 'm1', role: 'user', content: '', timestamp: 1, images: [PNG] }
    ])

    expect(result.ok).toBe(true)

    const body = sentBody()
    const userTurn = body.messages.find((m) => m.role === 'user')
    expect(userTurn?.content).toEqual([{ type: 'image_url', image_url: { url: PNG } }])
  })

  it('does not emit an empty text part for an image-only turn', async () => {
    seedOkProvider()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    await sendHandler({ sender: {} }, [
      { id: 'm1', role: 'user', content: '', timestamp: 1, images: [PNG] }
    ])

    const content = sentBody().messages.find((m) => m.role === 'user')?.content
    expect(Array.isArray(content)).toBe(true)
    expect(content).not.toContainEqual({ type: 'text', text: '' })
  })

  it('sends the image alongside typed text when both are present', async () => {
    seedOkProvider()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    await sendHandler({ sender: {} }, [
      { id: 'm1', role: 'user', content: 'Explain this', timestamp: 1, images: [PNG, JPEG] }
    ])

    const content = sentBody().messages.find((m) => m.role === 'user')?.content
    expect(content).toEqual([
      { type: 'text', text: 'Explain this' },
      { type: 'image_url', image_url: { url: PNG } },
      { type: 'image_url', image_url: { url: JPEG } }
    ])
  })

  it('forwards an image-only turn that follows earlier history', async () => {
    seedOkProvider()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    await sendHandler({ sender: {} }, [
      { id: 'm1', role: 'user', content: 'First question', timestamp: 1 },
      { id: 'm2', role: 'assistant', content: 'First answer', timestamp: 2 },
      { id: 'm3', role: 'user', content: '', timestamp: 3, images: [PNG] }
    ])

    const body = sentBody()
    expect(body.messages).toHaveLength(3)
    expect(body.messages[2].content).toEqual([{ type: 'image_url', image_url: { url: PNG } }])
  })

  it('treats a whitespace-only turn with an image as sendable', async () => {
    seedOkProvider()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, [
      { id: 'm1', role: 'user', content: '   \n  ', timestamp: 1, images: [PNG] }
    ])

    expect(result.ok).toBe(true)
    expect(sentBody().messages[0].content).toEqual([{ type: 'image_url', image_url: { url: PNG } }])
  })

  it('still rejects a transcript with no sendable turn', async () => {
    seedOkProvider()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, [
      { id: 'm1', role: 'user', content: '', timestamp: 1 },
      { id: 'm2', role: 'assistant', content: '', timestamp: 2 }
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_input')
    }
    expect(fetchWithSsrProtection).not.toHaveBeenCalled()
  })

  it('drops an empty-text turn that carries an empty images array', async () => {
    seedOkProvider()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    const result = await sendHandler({ sender: {} }, [
      { id: 'm1', role: 'user', content: '', timestamp: 1, images: [] }
    ])

    expect(result.ok).toBe(false)
    expect(fetchWithSsrProtection).not.toHaveBeenCalled()
  })

  it('never forwards images on an assistant turn', async () => {
    seedOkProvider()

    await main()
    const sendHandler = getHandler(IPC_CHANNELS.SEND_API_CHAT_REQUEST)
    await sendHandler({ sender: {} }, [
      { id: 'm1', role: 'user', content: 'question', timestamp: 1 },
      { id: 'm2', role: 'assistant', content: 'answer', timestamp: 2, images: [PNG] }
    ])

    const assistantTurn = sentBody().messages.find((m) => m.role === 'assistant')
    expect(assistantTurn?.content).toBe('answer')
  })
})
