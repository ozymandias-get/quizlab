/**
 * The built-in AI platform configs drive the AI sidebar. A wrong URL, a wrong
 * partition or a missing selector means the platform silently fails when the
 * user reaches for it, and the partitions decide who sees whose cookies, so
 * every invariant is asserted against the same set of modules from here.
 */
import { describe, expect, it } from 'vitest'

import { GOOGLE_AI_WEB_SESSION_PARTITION } from '../../../../../shared/constants/googleAiWebApps.js'
import aistudioPlatform from '../../../../features/ai/platforms/aistudio.js'
import chatgptPlatform from '../../../../features/ai/platforms/chatgpt.js'
import claudePlatform from '../../../../features/ai/platforms/claude.js'
import deepseekPlatform from '../../../../features/ai/platforms/deepseek.js'
import geminiPlatform from '../../../../features/ai/platforms/gemini.js'
import kimiPlatform from '../../../../features/ai/platforms/kimi.js'
import m365Platform from '../../../../features/ai/platforms/m365.js'
import qwenPlatform from '../../../../features/ai/platforms/qwen.js'
import youtubePlatform from '../../../../features/ai/platforms/youtube.js'

type Platform = Record<string, unknown> & { meta: Record<string, unknown> }

const platforms: Record<string, Platform> = {
  aistudio: aistudioPlatform as Platform,
  chatgpt: chatgptPlatform as Platform,
  claude: claudePlatform as Platform,
  deepseek: deepseekPlatform as Platform,
  gemini: geminiPlatform as Platform,
  kimi: kimiPlatform as Platform,
  m365: m365Platform as Platform,
  qwen: qwenPlatform as Platform,
  youtube: youtubePlatform as Platform
}

const entries = Object.entries(platforms)

/** The Google trio runs in one browser partition; everyone else gets their own. */
const googlePartitions = ['gemini', 'aistudio', 'youtube']

describe('AI platform config shape', () => {
  it.each(entries)('%s identifies itself by its own id', (id, platform) => {
    expect(platform.id).toBe(id)
    expect(platform.id).toMatch(/^[a-z][\d_a-z]*$/)
    expect(platform.name).toBeTypeOf('string')
    expect((platform.name as string).length).toBeGreaterThan(0)
  })

  it.each(entries)('%s carries a usable url, partition, icon and colour', (_id, platform) => {
    // Every one of these loads remote content into a managed view, so plain http
    // is not a valid configuration for any of them.
    expect(platform.url).toMatch(/^https:\/\//)
    expect(platform.partition).toMatch(/^persist:/)
    expect(platform.icon).toBeTypeOf('string')
    expect(platform.color).toMatch(/^#[\da-f]{6}$/i)
  })

  it.each(entries)('%s declares a meta block with a compilable domainRegex', (_id, platform) => {
    expect(platform.meta.displayName).toBeTypeOf('string')
    expect(platform.meta.domainRegex).toBeTypeOf('string')
    expect(() => new RegExp(platform.meta.domainRegex as string)).not.toThrow()
  })

  it.each(entries)(
    '%s has selectors and a submit mode, unless it is a plain site',
    (_id, platform) => {
      if (platform.isSite) {
        expect(platform.selectors).toBeUndefined()
        expect(platform.meta.submitMode).toBeUndefined()
        return
      }
      expect(platform.selectors).toBeDefined()
      expect(platform.meta.submitMode).toMatch(/^(mixed|click|enter_key)$/)
    }
  )
})

describe('AI platform input selectors', () => {
  // ChatGPT, Claude, DeepSeek and Qwen delegate selector resolution to the AI
  // sender at runtime, so their stored input is deliberately null.
  it.each(['chatgpt', 'claude', 'deepseek', 'qwen'])(
    '%s stores a null input for the AI sender to infer',
    (id) => {
      expect(getInput(platforms[id])).toBeNull()
    }
  )

  it.each([
    ['gemini', geminiPlatform],
    ['aistudio', aistudioPlatform],
    ['kimi', kimiPlatform]
  ])('%s stores its own input selector', (_id, platform) => {
    const input = getInput(platform as unknown as Platform)
    expect(input).toBeTypeOf('string')
    expect((input as string).length).toBeGreaterThan(10)
  })
})

describe('AI platform partitions', () => {
  it.each(googlePartitions)('%s shares the Google AI web session partition', (id) => {
    expect(platforms[id].partition).toBe(GOOGLE_AI_WEB_SESSION_PARTITION)
  })

  it.each(entries.filter(([id]) => !googlePartitions.includes(id)))(
    '%s owns a partition that does not collide with the Google one',
    (_id, platform) => {
      expect(platform.partition).not.toBe(GOOGLE_AI_WEB_SESSION_PARTITION)
      expect(platform.partition).toMatch(/^persist:ai_/)
    }
  )
})

describe('YouTube is the only plain site', () => {
  it('is marked isSite', () => {
    expect(youtubePlatform.isSite).toBe(true)
  })

  it.each(entries.filter(([id]) => id !== 'youtube'))('%s is not a site', (_id, platform) => {
    expect(platform.isSite ?? false).toBe(false)
  })
})

/** Some platforms expose `input` at the top level, others nest it under `selectors`. */
function getInput(platform: Platform): unknown {
  const selectors = platform.selectors as { input?: unknown } | undefined
  return platform.input !== undefined ? platform.input : selectors?.input
}
