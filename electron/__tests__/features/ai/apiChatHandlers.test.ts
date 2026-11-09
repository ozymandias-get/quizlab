import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IPC_CHANNELS } from '../../../../shared/constants/ipcChannels.js'

type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>

const handlers = vi.hoisted(() => new Map<string, Handler>())
const loadConfig = vi.hoisted(() => vi.fn())
const fetchWithSsrProtection = vi.hoisted(() => vi.fn())

vi.mock('../../../core/typedIpcMain.js', () => ({
  registerIpcHandler: (channel: string, handler: Handler) => {
    handlers.set(channel, handler)
  }
}))

vi.mock('../../../core/ipcSecurity.js', () => ({
  requireTrustedIpcSender: () => true
}))

vi.mock('../../../features/ai/apiChatHandlers/config.js', () => ({
  loadConfig,
  saveConfig: vi.fn(async () => true),
  sanitizeApiKey: (key: string) => key.trim()
}))

vi.mock('../../../features/ai/apiChatHandlers/ssrf.js', () => ({
  fetchWithSsrProtection,
  getSsrOptionsForProvider: () => ({}),
  validateProviderUrl: () => null
}))

import { registerApiChatHandlers } from '../../../features/ai/apiChatHandlers/apiChatHandlers.js'

// The module registers its handlers once; the map lives for the whole file.
registerApiChatHandlers()

const CONFIG = {
  selectedProviderId: 'provider-a',
  providers: [
    {
      id: 'provider-a',
      name: 'Provider A',
      baseUrl: 'https://a.example',
      apiKey: 'key-a',
      defaultModel: 'model-a'
    },
    {
      id: 'provider-b',
      name: 'Provider B',
      baseUrl: 'https://b.example',
      apiKey: 'key-b',
      defaultModel: 'model-b'
    }
  ],
  memoryPrompt: '',
  characterPrompt: '',
  generalPrompt: ''
}

const MESSAGES = [{ role: 'user', content: 'hello' }]

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function send(requestId: string, providerId = 'provider-a'): Promise<unknown> {
  return handlers.get(IPC_CHANNELS.SEND_API_CHAT_REQUEST)!(
    {},
    MESSAGES,
    undefined,
    undefined,
    providerId,
    requestId
  )
}

function fetchModels(providerId: string): Promise<unknown> {
  return handlers.get(IPC_CHANNELS.FETCH_API_CHAT_MODELS)!({}, providerId)
}

describe('the API chat handlers', () => {
  beforeEach(() => {
    loadConfig.mockReset()
    loadConfig.mockResolvedValue(CONFIG)
    fetchWithSsrProtection.mockReset()
  })

  it('starts only one HTTP request for the same requestId', async () => {
    let release!: (response: Response) => void
    fetchWithSsrProtection.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve
        })
    )

    const first = send('same-request')
    await vi.waitFor(() => expect(fetchWithSsrProtection).toHaveBeenCalledTimes(1))

    const duplicate = await send('same-request')

    expect(duplicate).toMatchObject({
      ok: false,
      error: { details: { reason: 'duplicate_request', requestId: 'same-request' } }
    })
    expect(fetchWithSsrProtection).toHaveBeenCalledTimes(1)

    release(jsonResponse({ choices: [{ message: { content: 'answer' } }] }))
    await expect(first).resolves.toMatchObject({ ok: true })
  })

  it('accepts an answer split into content parts', async () => {
    fetchWithSsrProtection.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: 'hel' },
                { type: 'text', text: 'lo' }
              ]
            }
          }
        ]
      })
    )

    await expect(send('parts')).resolves.toMatchObject({
      ok: true,
      data: { content: 'hello' }
    })
  })

  it('accepts the legacy choice text shape', async () => {
    fetchWithSsrProtection.mockResolvedValueOnce(jsonResponse({ choices: [{ text: 'legacy' }] }))

    await expect(send('legacy')).resolves.toMatchObject({
      ok: true,
      data: { content: 'legacy' }
    })
  })

  it('gives each answer a unique id instead of a clock value', async () => {
    fetchWithSsrProtection.mockImplementation(async () =>
      jsonResponse({ choices: [{ message: { content: 'answer' } }] })
    )

    const first = (await send('id-one')) as { data: { id: string } }
    const second = (await send('id-two')) as { data: { id: string } }

    expect(first.data.id).toMatch(/^msg-[\da-f-]{36}$/)
    expect(second.data.id).toMatch(/^msg-[\da-f-]{36}$/)
    expect(first.data.id).not.toBe(second.data.id)
  })

  it('lets two providers fetch their models at the same time', async () => {
    const signals: AbortSignal[] = []
    fetchWithSsrProtection.mockImplementation(async (_url: string, options: never) => {
      signals.push((options as { signal: AbortSignal }).signal)
      return jsonResponse({ data: [{ id: 'model' }] })
    })

    const [first, second] = await Promise.all([
      fetchModels('provider-a'),
      fetchModels('provider-b')
    ])

    expect(first).toMatchObject({ ok: true })
    expect(second).toMatchObject({ ok: true })
    expect(fetchWithSsrProtection).toHaveBeenCalledTimes(2)
    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal.aborted === false)).toBe(true)
  })

  it('still supersedes an older model fetch for the same provider', async () => {
    const signals: AbortSignal[] = []
    let release!: (response: Response) => void
    fetchWithSsrProtection
      .mockImplementationOnce(async (_url: string, options: never) => {
        signals.push((options as { signal: AbortSignal }).signal)
        return new Promise<Response>((resolve) => {
          release = resolve
        })
      })
      .mockImplementationOnce(async (_url: string, options: never) => {
        signals.push((options as { signal: AbortSignal }).signal)
        return jsonResponse({ data: [{ id: 'newer' }] })
      })

    const older = fetchModels('provider-a')
    await vi.waitFor(() => expect(fetchWithSsrProtection).toHaveBeenCalledTimes(1))
    const newer = fetchModels('provider-a')

    await expect(newer).resolves.toMatchObject({ ok: true })
    expect(signals[0].aborted).toBe(true)

    release(jsonResponse({ data: [] }))
    await older
  })
})
