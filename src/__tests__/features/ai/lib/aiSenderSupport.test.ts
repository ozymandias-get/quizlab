import { describe, expect, it } from 'vitest'
import {
  mergeAiConfigs,
  toAutomationConfig,
  buildPromptText,
  mergePromptText,
  isWebviewUsable,
  normalizeSendErrorCode,
  queueForWebview
} from '@features/ai/lib/aiSenderSupport'
import type { AiConfig } from '@features/ai/lib/aiSenderSupport'

describe('normalizeSendErrorCode', () => {
  it('returns trimmed string as-is', () => {
    expect(normalizeSendErrorCode('  test error  ', 'fallback')).toBe('test error')
  })

  it('returns fallback for empty string', () => {
    expect(normalizeSendErrorCode('', 'fallback')).toBe('fallback')
  })

  it('returns fallback for "Illegal invocation"', () => {
    expect(normalizeSendErrorCode('Illegal invocation', 'fallback')).toBe('fallback')
  })

  it('converts number to string', () => {
    expect(normalizeSendErrorCode(404, 'fallback')).toBe('404')
  })

  it('returns fallback for non-string/non-number', () => {
    expect(normalizeSendErrorCode(null, 'fallback')).toBe('fallback')
    expect(normalizeSendErrorCode(undefined, 'fallback')).toBe('fallback')
    expect(normalizeSendErrorCode({}, 'fallback')).toBe('fallback')
  })
})

describe('mergeAiConfigs', () => {
  const baseConfig: AiConfig = {
    input: '#input',
    button: '#send',
    submitMode: 'mixed',
    domainRegex: 'example\\.com'
  }

  it('returns base when override is null', () => {
    expect(mergeAiConfigs(baseConfig, null)).toBe(baseConfig)
  })

  it('returns base when override is undefined', () => {
    expect(mergeAiConfigs(baseConfig, undefined)).toBe(baseConfig)
  })

  it('merges defined override properties', () => {
    const override: AiConfig = { input: '.new-input', button: '.new-btn' }
    const result = mergeAiConfigs(baseConfig, override)
    expect(result.input).toBe('.new-input')
    expect(result.button).toBe('.new-btn')
    expect(result.submitMode).toBe('mixed')
  })

  it('does not merge undefined override properties', () => {
    const override: Partial<AiConfig> = { input: '.new-input' }
    const result = mergeAiConfigs(baseConfig, override as AiConfig)
    expect(result.input).toBe('.new-input')
    expect(result.button).toBe('#send')
  })

  it('normalizes submitMode from override', () => {
    const override: AiConfig = { submitMode: 'enter' }
    const result = mergeAiConfigs(baseConfig, override)
    expect(result.submitMode).toBe('enter_key')
  })

  it('falls back to base submitMode when override submitMode is undefined', () => {
    const override: Partial<AiConfig> = { input: '.x' }
    const result = mergeAiConfigs(baseConfig, override as AiConfig)
    expect(result.submitMode).toBe('mixed')
  })

  it('handles appendPromptAfterPaste: false', () => {
    const base: AiConfig = { ...baseConfig, appendPromptAfterPaste: true }
    const override: AiConfig = { appendPromptAfterPaste: false }
    const result = mergeAiConfigs(base, override)
    expect(result.appendPromptAfterPaste).toBe(false)
  })

  it('handles appendPromptAfterPaste: true', () => {
    const base: AiConfig = { ...baseConfig, appendPromptAfterPaste: false }
    const override: AiConfig = { appendPromptAfterPaste: true }
    const result = mergeAiConfigs(base, override)
    expect(result.appendPromptAfterPaste).toBe(true)
  })
})

describe('toAutomationConfig', () => {
  it('converts valid config correctly', () => {
    const config: AiConfig = {
      input: '#input',
      button: '#send',
      waitFor: '.loaded',
      submitMode: 'enter',
      inputCandidates: ['.a', '.b'],
      buttonCandidates: ['#x'],
      inputFingerprint: { version: 1, hash: 'fp1' } as any,
      buttonFingerprint: { version: 1, hash: 'fp2' } as any,
      sourceUrl: 'https://example.com',
      sourceHostname: 'example.com',
      canonicalHostname: 'example.com',
      version: 2
    }
    const result = toAutomationConfig(config)
    expect(result.input).toBe('#input')
    expect(result.button).toBe('#send')
    expect(result.waitFor).toBe('.loaded')
    expect(result.submitMode).toBe('enter_key')
    expect(result.inputCandidates).toEqual(['.a', '.b'])
    expect(result.buttonCandidates).toEqual(['#x'])
    expect(result.inputFingerprint).toEqual({ version: 1, hash: 'fp1' })
    expect(result.buttonFingerprint).toEqual({ version: 1, hash: 'fp2' })
    expect(result.sourceUrl).toBe('https://example.com')
    expect(result.sourceHostname).toBe('example.com')
    expect(result.canonicalHostname).toBe('example.com')
    expect(result.version).toBe(2)
  })

  it('sets null for invalid types', () => {
    const config = { input: 123, button: {}, waitFor: [] } as unknown as AiConfig
    const result = toAutomationConfig(config)
    expect(result.input).toBeNull()
    expect(result.button).toBeNull()
    expect(result.waitFor).toBeNull()
  })

  it('handles null input/button', () => {
    const config: AiConfig = { input: null, button: null, submitMode: 'click' }
    const result = toAutomationConfig(config)
    expect(result.input).toBeNull()
    expect(result.button).toBeNull()
  })
})

describe('buildPromptText', () => {
  it('returns text when no prompt', () => {
    expect(buildPromptText('hello')).toBe('hello')
  })

  it('returns text when prompt is null', () => {
    expect(buildPromptText('hello', null)).toBe('hello')
  })

  it('prepends prompt with separator', () => {
    expect(buildPromptText('hello', 'Say this:')).toBe('Say this:\n\nhello')
  })
})

describe('mergePromptText', () => {
  it('returns empty string when both are null/undefined', () => {
    expect(mergePromptText(null, undefined)).toBe('')
  })

  it('returns base when extra is empty', () => {
    expect(mergePromptText('base', '')).toBe('base')
  })

  it('returns extra when base is empty', () => {
    expect(mergePromptText('', 'extra')).toBe('extra')
  })

  it('merges both with separator', () => {
    expect(mergePromptText('base', 'extra')).toBe('base\n\nextra')
  })

  it('trims whitespace', () => {
    expect(mergePromptText('  base  ', '  extra  ')).toBe('base\n\nextra')
  })
})

describe('isWebviewUsable', () => {
  it('returns false when webview ref does not match', () => {
    const ref = { current: {} as any }
    const webview = {} as any
    expect(isWebviewUsable(ref, webview)).toBe(false)
  })

  it('returns false when expected does not match', () => {
    const wv1 = {} as any
    const wv2 = {} as any
    const ref = { current: wv1 }
    expect(isWebviewUsable(ref, wv1, wv2)).toBe(false)
  })

  it('returns false when webview is destroyed', () => {
    const wv = { isDestroyed: () => true } as any
    const ref = { current: wv }
    expect(isWebviewUsable(ref, wv)).toBe(false)
  })

  it('returns true when webview is usable', () => {
    const wv = { isDestroyed: () => false } as any
    const ref = { current: wv }
    expect(isWebviewUsable(ref, wv)).toBe(true)
  })

  it('returns true when isDestroyed is not available', () => {
    const wv = {} as any
    const ref = { current: wv }
    expect(isWebviewUsable(ref, wv)).toBe(true)
  })
})

describe('queueForWebview', () => {
  it('executes tasks in order', async () => {
    const webview = {} as any
    const results: number[] = []

    const p1 = queueForWebview(webview, async () => {
      await new Promise((r) => setTimeout(r, 10))
      results.push(1)
      return 'a'
    })

    const p2 = queueForWebview(webview, async () => {
      results.push(2)
      return 'b'
    })

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('a')
    expect(r2).toBe('b')
    expect(results).toEqual([1, 2])
  })

  it('handles task rejection without breaking queue', async () => {
    const webview = {} as any

    await expect(
      queueForWebview(webview, async () => {
        throw new Error('fail')
      })
    ).rejects.toThrow('fail')

    const result = await queueForWebview(webview, async () => {
      return 'ok'
    })

    expect(result).toBe('ok')
  })
})
