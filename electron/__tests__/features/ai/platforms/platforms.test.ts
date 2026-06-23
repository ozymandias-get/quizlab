import { describe, expect, it } from 'vitest'

import aistudioPlatform from '../../../../features/ai/platforms/aistudio'
import chatgptPlatform from '../../../../features/ai/platforms/chatgpt'
import claudePlatform from '../../../../features/ai/platforms/claude'
import deepseekPlatform from '../../../../features/ai/platforms/deepseek'
import geminiPlatform from '../../../../features/ai/platforms/gemini'
import kimiPlatform from '../../../../features/ai/platforms/kimi'
import m365Platform from '../../../../features/ai/platforms/m365'
import qwenPlatform from '../../../../features/ai/platforms/qwen'
import youtubePlatform from '../../../../features/ai/platforms/youtube'

const platforms = {
  gemini: geminiPlatform,
  aistudio: aistudioPlatform,
  youtube: youtubePlatform,
  chatgpt: chatgptPlatform,
  claude: claudePlatform,
  deepseek: deepseekPlatform,
  kimi: kimiPlatform,
  m365: m365Platform,
  qwen: qwenPlatform
} as const

describe('AI platform configs', () => {
  for (const [id, platform] of Object.entries(platforms)) {
    const p = platform as Record<string, unknown>
    const meta = p.meta as Record<string, unknown> | undefined

    it(`${id} has required fields`, () => {
      expect(p.id).toBe(id)
      expect(p.name).toBeTypeOf('string')
      expect(p.url).toMatch(/^https?:\/\//)
      expect(p.partition).toBeTypeOf('string')
      expect(p.icon).toBeTypeOf('string')
      expect(p.color).toMatch(/^#[\da-f]{6}$/i)
      expect(meta).toBeDefined()
      expect(meta?.displayName).toBeTypeOf('string')
      expect(meta?.domainRegex).toBeTypeOf('string')
    })

    it(`${id} has selectors or isSite flag`, () => {
      if (p.isSite) {
        expect(p.selectors).toBeUndefined()
        expect(meta?.submitMode).toBeUndefined()
      } else {
        expect(p.selectors).toBeDefined()
        expect(meta?.submitMode).toMatch(/^(mixed|click|enter_key)$/)
      }
    })

    it(`${id} domainRegex is valid regex`, () => {
      expect(() => new RegExp(meta?.domainRegex as string)).not.toThrow()
    })
  }

  describe('shared partition constant', () => {
    it('Gemini uses GOOGLE_AI_WEB_SESSION_PARTITION', () => {
      expect(geminiPlatform.partition).toBe(aistudioPlatform.partition)
    })
  })

  describe('YouTube is site-only', () => {
    it('has isSite: true and no selectors', () => {
      const p = youtubePlatform as Record<string, unknown>
      const meta = p.meta as Record<string, unknown>
      expect(p.isSite).toBe(true)
      expect(p.selectors).toBeUndefined()
      expect(meta.submitMode).toBeUndefined()
    })
  })
})
