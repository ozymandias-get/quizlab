/**
 * Extended AI sender support tests covering resolveAutoSend, getCachedAiConfig,
 * and additional edge cases for the merge/normalize utilities.
 */
import type { AiContentController } from '@shared-core/types/aiContent'

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

const makeController = (
  url: string | null = 'https://chatgpt.com/?model=gpt-4'
): AiContentController =>
  ({
    isDestroyed: () => false,
    getURL: () => url
  }) as unknown as AiContentController

const makeQueryClient = (fetchResult: unknown) =>
  ({
    fetchQuery: vi.fn().mockResolvedValue(fetchResult)
  }) as any

describe('resolveAutoSend', () => {
  // A defined per-call option wins; an absent one falls back to the global
  // preference. The rows that matter most are the last two: a disabled global
  // must stay un-bypassable (the removed `forceAutoSend` escape hatch let the
  // composer submit anyway).
  it.each([
    ['a per-call true overrides a false global', false, { autoSend: true }, true],
    ['a per-call false overrides a true global', true, { autoSend: false }, false],
    ['no options falls back to a true global', true, undefined, true],
    ['no options falls back to a false global', false, undefined, false],
    ['empty options falls back to a true global', true, {}, true],
    ['empty options falls back to a false global', false, {}, false],
    ['a false global cannot be bypassed by a false per-call', false, { autoSend: false }, false],
    ['a false global cannot be bypassed by no options', false, {}, false],
    ['a truthy non-boolean passes through', false, { autoSend: 1 as any }, 1],
    ['a falsy non-boolean passes through', true, { autoSend: 0 as any }, 0],
    // `null` is not undefined, so it is returned as-is
    ['a null per-call passes through', false, { autoSend: null as any }, null]
  ])('%s', (_case, globalPref, options, expected) => {
    expect(resolveAutoSend(globalPref as boolean, options as any)).toBe(expected)
  })
})

describe('getCachedAiConfig', () => {
  let cache: { key: string | null; cache: any }

  beforeEach(() => {
    cache = { key: null, cache: null }
  })

  it('returns base config when content has no getURL method', async () => {
    const base: AiConfig = { input: 'i' }
    const result = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient: makeQueryClient(null),
      content: {} as AiContentController
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
      content: makeController(null)
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
      content: makeController('https://chatgpt.com/c/abc')
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
    const content = makeController('https://chatgpt.com/c/abc')
    const queryClient = makeQueryClient({ input: 'remote' })

    const first = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      content
    })

    // Second call should not re-fetch
    const second = await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      content
    })

    expect(second).toBe(first)
    expect(queryClient.fetchQuery).toHaveBeenCalledTimes(1)
  })

  it('busts cache when AI key changes', async () => {
    const base: AiConfig = { input: 'i' }
    const content = makeController('https://chatgpt.com/c/abc')
    const queryClient = makeQueryClient({ input: 'remote' })

    await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      content
    })

    await getCachedAiConfig({
      baseConfig: base,
      configCache: cache,
      currentAI: 'gemini', // different AI
      queryClient,
      content
    })

    expect(queryClient.fetchQuery).toHaveBeenCalledTimes(2)
  })

  it('busts cache when base config changes', async () => {
    const content = makeController('https://chatgpt.com/c/abc')
    const queryClient = makeQueryClient({ input: 'remote' })

    await getCachedAiConfig({
      baseConfig: { input: 'first' },
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      content
    })

    await getCachedAiConfig({
      baseConfig: { input: 'second' }, // different config
      configCache: cache,
      currentAI: 'chatgpt',
      queryClient,
      content
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
      content: makeController()
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
      content: makeController()
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
      content: makeController()
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
  it.each([
    [
      'null nullable fields stay null',
      { input: null, button: null, waitFor: null },
      { input: null, button: null, waitFor: null }
    ],
    [
      'non-array candidates become null',
      { inputCandidates: 'not-array', buttonCandidates: 42 },
      { inputCandidates: null, buttonCandidates: null }
    ],
    ['an empty input yields null everywhere', {}, { inputFingerprint: null }],
    [
      'array candidates are kept as-is',
      { inputCandidates: ['a', 'b'], buttonCandidates: ['c', 'd'] },
      { inputCandidates: ['a', 'b'], buttonCandidates: ['c', 'd'] }
    ],
    [
      'non-string sourceUrl/sourceHostname become null',
      { sourceUrl: 123, sourceHostname: null },
      { sourceUrl: null, sourceHostname: null }
    ]
  ])('%s', (_case, input, expected) => {
    expect(toAutomationConfig(input as any)).toMatchObject(expected)
  })
})

describe('normalizeSendErrorCode - additional edge cases', () => {
  it.each([
    ['a real code passes through', 'webview_not_ready', 'webview_not_ready'],
    ['a spaces-only string falls back', '   ', 'fb'],
    ['a tab/newline-only string falls back', '\t\n', 'fb'],
    ['a boolean falls back', true, 'fb'],
    ['false falls back', false, 'fb'],
    ['an array falls back', [1, 2, 3], 'fb'],
    ['a number is stringified', 0, '0'],
    ['a negative number is stringified', -1, '-1'],
    ['the string "0" is preserved, not falsy-coerced', '0', '0']
  ])('%s', (_case, raw, expected) => {
    expect(normalizeSendErrorCode(raw, 'fb')).toBe(expected)
  })
})
