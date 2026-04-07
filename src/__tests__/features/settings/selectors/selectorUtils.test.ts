import { describe, expect, it } from 'vitest'
import {
  findSelectorEntry,
  hasSelectorLocator,
  normalizeExecutionResult,
  normalizeSelectorsData,
  toAutomationConfig
} from '../../../../features/settings/ui/selectors/selectorUtils'

describe('selectorUtils', () => {
  it('normalizes selectors map and ignores legacy single object shape', () => {
    const map = normalizeSelectorsData({
      'chat.openai.com': { version: 2, input: '#prompt' }
    })
    expect(map['chat.openai.com']?.input).toBe('#prompt')

    const legacy = normalizeSelectorsData({ input: '#legacy' })
    expect(legacy).toEqual({})
  })

  it('detects locator presence from selectors and candidate metadata', () => {
    expect(hasSelectorLocator({ input: '#prompt' })).toBe(true)
    expect(hasSelectorLocator({ inputCandidates: ['textarea#p'] })).toBe(true)
    expect(hasSelectorLocator({})).toBe(false)
  })

  it('finds selector entry by direct host and source hostname fallback', () => {
    const ai = { id: 'test1', name: 'Test AI', url: 'https://chat.openai.com' } as any
    const direct = findSelectorEntry(ai, {
      'chat.openai.com': { version: 2, input: '#prompt' }
    })
    expect(direct?.hostname).toBe('chat.openai.com')

    const fallback = findSelectorEntry(ai, {
      'alias.example.com': { version: 2, input: '#prompt', sourceHostname: 'chat.openai.com' }
    })
    expect(fallback?.hostname).toBe('alias.example.com')
  })

  it('normalizes automation execution result payloads', () => {
    expect(normalizeExecutionResult(true)).toEqual({ success: true })
    expect(normalizeExecutionResult({ error: 'selector_not_found' })?.success).toBe(false)
    expect(normalizeExecutionResult(null)).toBeNull()
  })

  it('maps selector config into automation config shape', () => {
    const config = toAutomationConfig({
      version: 2,
      input: '#prompt',
      button: null,
      submitMode: 'enter_key',
      sourceHostname: 'chat.openai.com'
    })

    expect(config).toMatchObject({
      version: 2,
      input: '#prompt',
      button: null,
      submitMode: 'enter_key',
      sourceHostname: 'chat.openai.com'
    })
  })
})
