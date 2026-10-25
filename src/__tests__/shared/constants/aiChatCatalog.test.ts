import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import { ADDITIONAL_AI_CHAT_PLATFORMS, isAiDockVisible } from '@shared-core/constants/aiChatCatalog'
import { AI_REGISTRY } from '../../../../electron/features/ai/aiManager'
import { describe, expect, it } from 'vitest'

describe('AI chat catalogue integration', () => {
  it('exposes the same 50 web chat services in desktop and browser registries', () => {
    const desktop = Object.values(AI_REGISTRY).filter((p) => !p.isSite && p.url)
    const browser = Object.values(WEB_AI_REGISTRY).filter((p) => !p.isSite && p.url)
    expect(desktop).toHaveLength(50)
    expect(browser.map((p) => p.id).sort()).toEqual(desktop.map((p) => p.id).sort())
    expect(new Set(desktop.map((p) => p.id)).size).toBe(50)
    for (const platform of desktop) {
      expect(new URL(platform.url).protocol).toBe('https:')
      expect(platform.partition).toMatch(/^persist:ai_|^persist:gemini_web_profile/)
    }
  })

  it('requires a separate dock opt-in for every additional service', () => {
    for (const [id, platform] of Object.entries(ADDITIONAL_AI_CHAT_PLATFORMS)) {
      expect(platform.defaultEnabled).toBe(false)
      expect(isAiDockVisible(id, {}, platform)).toBe(false)
      expect(isAiDockVisible(id, { [id]: true }, platform)).toBe(true)
      expect(isAiDockVisible(id, { [id]: false }, platform)).toBe(false)
    }
    expect(isAiDockVisible('chatgpt', {})).toBe(true)
    expect(isAiDockVisible('chatgpt', { chatgpt: false })).toBe(false)
  })
})
