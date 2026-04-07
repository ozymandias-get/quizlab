import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolveSendContext } from '@features/ai/lib/send/resolveSendContext'

const mockIsWebviewUsable = vi.fn()
const mockGetCachedAiConfig = vi.fn()

vi.mock('@features/ai/lib/aiSenderSupport', () => ({
  isWebviewUsable: (...args: unknown[]) => mockIsWebviewUsable(...args),
  getCachedAiConfig: (...args: unknown[]) => mockGetCachedAiConfig(...args)
}))

describe('resolveSendContext', () => {
  const webviewRef = { current: null as any }
  const webview = { getURL: vi.fn(() => 'https://openai.com/chat') } as any
  const queryClient = {} as any
  const configCache = { key: null, data: null }
  const aiRegistry = {
    'gpt-4': { input: '#input', button: '#send', submitMode: 'click', domainRegex: 'openai\\.com' }
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    webviewRef.current = webview
    webview.getURL.mockReturnValue('https://openai.com/chat')
    mockIsWebviewUsable.mockReturnValue(true)
    mockGetCachedAiConfig.mockResolvedValue({
      config: aiRegistry['gpt-4'],
      regex: /openai\.com/
    })
  })

  it('returns registry_not_loaded when registry is missing', async () => {
    const result = await resolveSendContext({
      webviewRef,
      webview,
      scheduledWebview: webview,
      aiRegistry: null,
      currentAI: 'gpt-4',
      queryClient,
      configCache
    })
    expect(result).toEqual({ success: false, error: 'registry_not_loaded' })
  })

  it('returns wrong_url when domain regex does not match', async () => {
    webview.getURL.mockReturnValue('https://example.com')
    const result = await resolveSendContext({
      webviewRef,
      webview,
      scheduledWebview: webview,
      aiRegistry,
      currentAI: 'gpt-4',
      queryClient,
      configCache
    })

    expect(result).toEqual({
      success: false,
      error: 'wrong_url',
      actualUrl: 'https://example.com'
    })
  })

  it('returns resolved context when inputs are valid', async () => {
    const result = await resolveSendContext({
      webviewRef,
      webview,
      scheduledWebview: webview,
      aiRegistry,
      currentAI: 'gpt-4',
      queryClient,
      configCache
    })

    expect(result).toEqual({
      aiConfig: aiRegistry['gpt-4'],
      currentUrl: 'https://openai.com/chat'
    })
  })
})
