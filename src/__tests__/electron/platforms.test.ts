/**
 * Tests for the built-in AI platform configurations.
 *
 * These configs drive the AI sidebar — wrong URL, wrong partition, or
 * missing selector means the platform will silently fail when the user
 * tries to use it. Tests pin down the public contract.
 */
import { describe, expect, it } from 'vitest'

import aistudio from '../../../electron/features/ai/platforms/aistudio'
import chatgpt from '../../../electron/features/ai/platforms/chatgpt'
import claude from '../../../electron/features/ai/platforms/claude'
import deepseek from '../../../electron/features/ai/platforms/deepseek'
import gemini from '../../../electron/features/ai/platforms/gemini'
import kimi from '../../../electron/features/ai/platforms/kimi'
import qwen from '../../../electron/features/ai/platforms/qwen'
import youtube from '../../../electron/features/ai/platforms/youtube'
import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../../../shared/constants/google-ai-web-apps'

describe('AI platform configs - structural invariants', () => {
  const platforms: Record<string, any> = {
    aistudio,
    chatgpt,
    claude,
    deepseek,
    gemini,
    kimi,
    qwen,
    youtube
  }

  for (const [name, platform] of Object.entries(platforms)) {
    describe(name, () => {
      it('has a non-empty id', () => {
        expect(typeof platform.id).toBe('string')
        expect(platform.id.length).toBeGreaterThan(0)
      })

      it('has a non-empty display name', () => {
        expect(typeof platform.name).toBe('string')
        expect(platform.name.length).toBeGreaterThan(0)
      })

      it('has a URL starting with https://', () => {
        expect(platform.url).toMatch(/^https:\/\//)
      })

      it('has a non-empty partition', () => {
        expect(typeof platform.partition).toBe('string')
        expect(platform.partition.length).toBeGreaterThan(0)
      })

      it('has a non-empty icon name', () => {
        expect(typeof platform.icon).toBe('string')
        expect(platform.icon.length).toBeGreaterThan(0)
      })

      it('has a color that looks like a hex', () => {
        expect(platform.color).toMatch(/^#[\dA-Fa-f]{3,6}$/)
      })

      it('id matches its config name', () => {
        // Configs are named after their id (aistudio.ts → id: aistudio)
        // Some platforms use slightly different ids (e.g. ai_studio)
        expect(platform.id).toBe(name)
      })

      it('id uses lowercase + optional underscore', () => {
        expect(platform.id).toMatch(/^[a-z][\d_a-z]*$/)
      })
    })
  }
})

describe('AI platform configs - selectors', () => {
  /** Some platforms expose `input/button/waitFor` at the top level,
   *  others nest them under `selectors`. This helper accepts both. */
  function getInput(p: any): unknown {
    return p.input !== undefined ? p.input : p.selectors?.input
  }

  it('chatgpt has null input (delegated to the AI sender)', () => {
    // ChatGPT is special — selectors are null because they're inferred
    // at runtime by the AI sender.
    expect(getInput(chatgpt)).toBeNull()
  })

  it('claude has null input (delegated to the AI sender)', () => {
    expect(getInput(claude)).toBeNull()
  })

  it('deepseek has null input (delegated to the AI sender)', () => {
    expect(getInput(deepseek)).toBeNull()
  })

  it('qwen has null input (delegated to the AI sender)', () => {
    expect(getInput(qwen)).toBeNull()
  })

  it('gemini has a non-empty input selector list', () => {
    const input = getInput(gemini)
    expect(typeof input).toBe('string')
    expect((input as string).length).toBeGreaterThan(10)
  })

  it('aistudio has a non-empty input selector list', () => {
    const input = getInput(aistudio)
    expect(typeof input).toBe('string')
    expect((input as string).length).toBeGreaterThan(10)
  })

  it('kimi has a non-empty input selector list', () => {
    const input = getInput(kimi)
    expect(typeof input).toBe('string')
    expect((input as string).length).toBeGreaterThan(10)
  })
})

describe('AI platform configs - meta', () => {
  it('every platform has a meta block with displayName and domainRegex', () => {
    const platforms: any[] = [aistudio, chatgpt, claude, deepseek, gemini, kimi, qwen, youtube]
    for (const platform of platforms) {
      expect(platform.meta).toBeDefined()
      expect(typeof platform.meta.displayName).toBe('string')
      expect(typeof platform.meta.domainRegex).toBe('string')
    }
  })

  it('every platform with a submitMode has a valid value', () => {
    const platforms: any[] = [chatgpt, claude, gemini, deepseek, qwen, kimi, aistudio]
    for (const platform of platforms) {
      if (platform.meta.submitMode !== undefined) {
        expect(['enter_key', 'click', 'mixed']).toContain(platform.meta.submitMode)
      }
    }
  })

  it('every domainRegex is a non-empty string', () => {
    const platforms: any[] = [aistudio, chatgpt, claude, deepseek, gemini, kimi, qwen, youtube]
    for (const platform of platforms) {
      expect(platform.meta.domainRegex.length).toBeGreaterThan(0)
    }
  })
})

describe('Google web session apps - partition sharing', () => {
  it('gemini, aistudio, youtube share the same Google partition', () => {
    expect(gemini.partition).toBe(GOOGLE_AI_WEB_SESSION_PARTITION)
    expect(aistudio.partition).toBe(GOOGLE_AI_WEB_SESSION_PARTITION)
    expect(youtube.partition).toBe(GOOGLE_AI_WEB_SESSION_PARTITION)
  })

  it('chatgpt, claude, deepseek, qwen, kimi have their own partitions', () => {
    const others = [chatgpt, claude, deepseek, qwen, kimi]
    for (const p of others) {
      expect(p.partition).not.toBe(GOOGLE_AI_WEB_SESSION_PARTITION)
      expect(p.partition).toMatch(/^persist:ai_/)
    }
  })
})

describe('YouTube - site-specific behavior', () => {
  it('is marked as isSite: true', () => {
    expect(youtube.isSite).toBe(true)
  })

  it('other AI platforms do NOT have isSite set (or set to false)', () => {
    const others = [chatgpt, claude, gemini, deepseek, qwen, kimi, aistudio]
    for (const p of others) {
      // isSite is optional; when present, it should be false
      // (cast to optional boolean because some platform types don't declare it)
      if ((p as { isSite?: boolean }).isSite !== undefined) {
        expect((p as { isSite?: boolean }).isSite).toBe(false)
      }
    }
  })
})
