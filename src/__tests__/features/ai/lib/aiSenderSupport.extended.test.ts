/**
 * Extended AI sender support tests covering resolveAutoSend, getCachedAiConfig,
 * and additional edge cases for the merge/normalize utilities.
 */
import type { WebviewController } from '@shared-core/types/webview'

import type { AiConfig } from '@features/ai/lib/aiSenderSupport'
import {
  getCachedAiConfig,
  mergeAiConfigs,
  normalizeSendErrorCode,
  resolveAutoSend,
  toAutomationConfig
} from '@features/ai/lib/aiSenderSupport'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(() => ({
    getAiConfig: vi.fn().mockResolvedValue({ input: 'remote-input' })
  }))
}))

vi.mock('@shared/lib/logger', () => ({
  reportSuppressedError: vi.fn(),
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}))

const makeWebview = (url: string | null = 'https://chatgpt.com/?model=gpt-4'): WebviewController =>
  ({
    isDestroyed: () => false,
    getURL: () => url
  }) as unknown as WebviewController

const makeQueryClient = (fetchResult: unknown) =>
  ({
    fetchQuery: vi.fn().mockResolvedValue(fetchResult)
  }) as any

describe('resolveAutoSend', () => {
  it('returns true when forceAutoSend is true (overrides everything)', () => {
    expect(resolveAutoSend(false, { forceAutoSend: true })).toBe(true)
    expect(resolveAutoSend(false, { forceAutoSend: true, autoSend: false })).toBe(true)
  })

  it('uses the per-call option when no forceAutoSend is set', () => {
    expect(resolveAutoSend(false, { autoSend: true })).toBe(true)
    expect(resolveAutoSend(true, { autoSend: false })).toBe(false)
  })

  it('falls back to the default when no options are provided', () => {
    expect(resolveAutoSend(true)).toBe(true)
    expect(resolveAutoSend(false)).toBe(false)
  })

  it('falls back to the default when options is empty', () => {
    expect(resolveAutoSend(true, {})).toBe(true)
    expect(resolveAutoSend(false, {})).toBe(false)
  })

  it('prefers forceAutoSend over per-call autoSend', () => {
    expect(resolveAutoSend(false, { forceAutoSend: true, autoSend: false })).toBe(true)
  })

  it('handles truthy/falsy options correctly', () => {
    expect(resolveAutoSend(false, { autoSend: 1 as any })).toBe(1)
    expect(resolveAutoSend(true, { autoSend: 0 as any })).toBe(0)
    // `null` is not undefined, so it is returned as-is
    expect(resolveAutoSend(false, { autoSend: null as any })).toBe(null)
  })
})

describe('getCachedAiConfig', () => {
  let cache: { key: string | null; cache: any }

  beforeEach(() => {
    cache = { key: null, cache: null }
  })

  it('returns base config when webview has no getURL method', async () => {
    const base: AiConfig = { input: 'i' }
    const result = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient: makeQueryClient(null),
      webview: {} as WebviewController
    })
    expect(result.config).toBe(base)
    expect(result.regex).toBeNull()
  })

  it('returns base config when getURL returns null', async () => {
    const base: AiConfig = { input: 'i' }
    const result = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient: makeQueryClient(null),
      webview: makeWebview(null)
    })
    expect(result.config).toBe(base)
    expect(result.regex).toBeNull()
  })

  it('fetches and caches the merged config on first call', async () => {
    const base: AiConfig = { input: 'base-input', submitMode: 'mixed' }
    const remote = { input: 'remote-input', domainRegex: '^chatgpt\\.' }

    const result = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient: makeQueryClient(remote),
      webview: makeWebview('https://chatgpt.com/c/abc')
    })

    // Override should win
    expect(result.config.input).toBe('remote-input')
    // domainRegex should be a RegExp
    expect(result.regex).toBeInstanceOf(RegExp)
    // Cache should be populated
    expect(cache.key).toContain('chatgpt')
    expect(cache.cache).toBe(result)
  })

  it('returns cached entry on second call with the same key', async () => {
    const base: AiConfig = { input: 'i' }
    const webview = makeWebview('https://chatgpt.com/c/abc')
    const queryClient = makeQueryClient({ input: 'remote' })

    const first = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      webview
    })

    // Second call should not re-fetch
    const second = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      webview
    })

    expect(second).toBe(first)
    expect(queryClient.fetchQuery).toHaveBeenCalledTimes(1)
  })

  it('busts cache when AI key changes', async () => {
    const base: AiConfig = { input: 'i' }
    const webview = makeWebview('https://chatgpt.com/c/abc')
    const queryClient = makeQueryClient({ input: 'remote' })

    await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      webview
    })

    await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'gemini', // different AI
      queryClient,
      webview
    })

    expect(queryClient.fetchQuery).toHaveBeenCalledTimes(2)
  })

  it('busts cache when base config changes', async () => {
    const webview = makeWebview('https://chatgpt.com/c/abc')
    const queryClient = makeQueryClient({ input: 'remote' })

    await getCachedAiConfig({
      baseConfig: { input: 'first' },
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      webview
    })

    await getCachedAiConfig({
      baseConfig: { input: 'second' }, // different config
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      webview
    })

    expect(queryClient.fetchQuery).toHaveBeenCalledTimes(2)
  })

  it('returns base config and suppresses error on fetch failure', async () => {
    const base: AiConfig = { input: 'i' }
    const queryClient = {
      fetchQuery: vi.fn().mockRejectedValue(new Error('IPC down'))
    } as any
    const reportSuppressedError = (await import('@shared/lib/logger'))
      .reportSuppressedError as unknown as ReturnType<typeof vi.fn>
    reportSuppressedError.mockClear()

    const result = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      webview: makeWebview()
    })

    expect(result.config).toBe(base)
    expect(result.regex).toBeNull()
    expect(reportSuppressedError).toHaveBeenCalled()
  })

  it('handles null/falsy custom config gracefully', async () => {
    const base: AiConfig = { input: 'i' }
    const result = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient: makeQueryClient(null),
      webview: makeWebview()
    })
    // Base should win since override is null
    expect(result.config).toBe(base)
  })

  it('handles non-object custom config gracefully', async () => {
    const base: AiConfig = { input: 'i' }
    const result = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient: makeQueryClient('not-an-object'),
      webview: makeWebview()
    })
    // Should not crash; base wins
    expect(result.config.input).toBe('i')
  })
})

describe('mergeAiConfigs - additional edge cases', () => {
  it('handles empty override object', () => {
    const base: AiConfig = { input: 'i', button: 'b' }
    const result = mergeAiConfigs(base, {})
    expect(result.input).toBe('i')
    expect(result.button).toBe('b')
  })

  it('falls back to base submitMode when override is empty string', () => {
    // 'enter' is normalized to 'enter_key' inside normalizeSubmitMode
    const base: AiConfig = { submitMode: 'enter_key' }
    const result = mergeAiConfigs(base, { submitMode: '' as any })
    expect(result.submitMode).toBe('enter_key')
  })

  it('appends non-undefined keys from override', () => {
    const base: AiConfig = { input: 'i' }
    const result = mergeAiConfigs(base, {
      input: 'override',
      button: 'btn',
      waitFor: 'wait'
    })
    expect(result.input).toBe('override')
    expect(result.button).toBe('btn')
    expect(result.waitFor).toBe('wait')
  })

  it('does not override with undefined values', () => {
    const base: AiConfig = { input: 'i', button: 'b' }
    const result = mergeAiConfigs(base, { input: undefined, button: undefined })
    expect(result.input).toBe('i')
    expect(result.button).toBe('b')
  })
})

describe('toAutomationConfig - additional edge cases', () => {
  it('handles all nullable fields being null', () => {
    const result = toAutomationConfig({
      input: null,
      button: null,
      waitFor: null
    })
    expect(result.input).toBeNull()
    expect(result.button).toBeNull()
    expect(result.waitFor).toBeNull()
  })

  it('converts non-array candidates to null', () => {
    const result = toAutomationConfig({
      inputCandidates: 'not-array' as any,
      buttonCandidates: 42 as any
    })
    expect(result.inputCandidates).toBeNull()
    expect(result.buttonCandidates).toBeNull()
  })

  it('uses null for missing fingerprint', () => {
    const result = toAutomationConfig({})
    expect(result.inputFingerprint).toBeNull()
    expect(result.buttonFingerprint).toBeNull()
  })

  it('keeps array candidates', () => {
    const result = toAutomationConfig({
      inputCandidates: ['a', 'b'],
      buttonCandidates: ['c', 'd']
    })
    expect(result.inputCandidates).toEqual(['a', 'b'])
    expect(result.buttonCandidates).toEqual(['c', 'd'])
  })

  it('uses null sourceUrl/sourceHostname for non-string values', () => {
    const result = toAutomationConfig({
      sourceUrl: 123 as any,
      sourceHostname: null as any
    })
    expect(result.sourceUrl).toBeNull()
    expect(result.sourceHostname).toBeNull()
  })
})

describe('normalizeSendErrorCode - additional edge cases', () => {
  it('returns the string for strings', () => {
    expect(normalizeSendErrorCode('webview_not_ready', 'fb')).toBe('webview_not_ready')
  })

  it('handles whitespace-only strings', () => {
    expect(normalizeSendErrorCode('   ', 'fb')).toBe('fb')
    expect(normalizeSendErrorCode('\t\n', 'fb')).toBe('fb')
  })

  it('handles boolean input', () => {
    expect(normalizeSendErrorCode(true, 'fb')).toBe('fb')
    expect(normalizeSendErrorCode(false, 'fb')).toBe('fb')
  })

  it('handles array input', () => {
    expect(normalizeSendErrorCode([1, 2, 3], 'fb')).toBe('fb')
  })

  it('returns numeric value as string', () => {
    expect(normalizeSendErrorCode(0, 'fb')).toBe('0')
    expect(normalizeSendErrorCode(-1, 'fb')).toBe('-1')
  })

  it('preserves string "0"', () => {
    expect(normalizeSendErrorCode('0', 'fb')).toBe('0')
  })
})
