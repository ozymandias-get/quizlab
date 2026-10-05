import { isSendError, resolveSendContext } from '@features/ai/lib/send/resolveSendContext'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockIsContentUsable = vi.fn()
const mockGetCachedAiConfig = vi.fn()

vi.mock('@features/ai/lib/aiSenderSupport', () => ({
  isContentUsable: (...args: unknown[]) => mockIsContentUsable(...args),
  getCachedAiConfig: (...args: unknown[]) => mockGetCachedAiConfig(...args)
}))

describe('resolveSendContext', () => {
  const contentRef = { current: null as any }
  const content = { getURL: vi.fn(() => 'https://openai.com/chat') } as any
  const queryClient = {} as any
  const configCache = { key: null, cache: null }
  const aiRegistry = {
    'gpt-4': { input: '#input', button: '#send', submitMode: 'click', domainRegex: 'openai\\.com' }
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    contentRef.current = content
    content.getURL.mockReturnValue('https://openai.com/chat')
    mockIsContentUsable.mockReturnValue(true)
    mockGetCachedAiConfig.mockResolvedValue({
      config: aiRegistry['gpt-4'],
      regex: /openai\.com/
    })
  })

  it('returns registry_not_loaded when registry is missing', async () => {
    const result = await resolveSendContext({
      contentRef,
      content,
      scheduledContent: content,
      aiRegistry: null,
      currentAI: 'gpt-4',
      queryClient,
      configCache
    })
    expect(result).toEqual({ success: false, error: 'registry_not_loaded' })
  })

  it('returns wrong_url when domain regex does not match', async () => {
    content.getURL.mockReturnValue('https://example.com')
    const result = await resolveSendContext({
      contentRef,
      content,
      scheduledContent: content,
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
      contentRef,
      content,
      scheduledContent: content,
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

  it('returns webview_destroyed when content is not usable', async () => {
    mockIsContentUsable.mockReturnValue(false)

    const result = await resolveSendContext({
      contentRef,
      content,
      scheduledContent: content,
      aiRegistry,
      currentAI: 'gpt-4',
      queryClient,
      configCache
    })

    expect(result).toEqual({ success: false, error: 'webview_destroyed' })
    expect(mockGetCachedAiConfig).not.toHaveBeenCalled()
  })

  it('returns config_not_found when currentAI is missing from registry', async () => {
    const result = await resolveSendContext({
      contentRef,
      content,
      scheduledContent: content,
      aiRegistry,
      currentAI: 'unknown-model',
      queryClient,
      configCache
    })

    expect(result).toEqual({ success: false, error: 'config_not_found' })
    expect(mockGetCachedAiConfig).not.toHaveBeenCalled()
  })

  it('returns webview_api_missing when getURL is not a function', async () => {
    const badContent = { getURL: 'not-a-function' } as any
    contentRef.current = badContent

    const result = await resolveSendContext({
      contentRef,
      content: badContent,
      scheduledContent: badContent,
      aiRegistry,
      currentAI: 'gpt-4',
      queryClient,
      configCache
    })

    expect(result).toEqual({ success: false, error: 'webview_api_missing' })
  })

  it('returns webview_url_missing when getURL returns empty string', async () => {
    content.getURL.mockReturnValue('')

    const result = await resolveSendContext({
      contentRef,
      content,
      scheduledContent: content,
      aiRegistry,
      currentAI: 'gpt-4',
      queryClient,
      configCache
    })

    expect(result).toEqual({ success: false, error: 'webview_url_missing' })
  })
})

describe('isSendError', () => {
  const aiRegistry = {
    'gpt-4': { input: '#input', button: '#send', submitMode: 'click' as const }
  } as any

  it('narrows to SendTextResult when result has success field', () => {
    const err = { success: false as const, error: 'registry_not_loaded' }
    expect(isSendError(err)).toBe(true)
    if (isSendError(err)) {
      expect(err.error).toBe('registry_not_loaded')
    }
  })

  it('returns false for resolved send context shape', () => {
    const ok = { aiConfig: aiRegistry['gpt-4'], currentUrl: 'https://openai.com/chat' }
    expect(isSendError(ok)).toBe(false)
  })
})
