import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import { ADDITIONAL_AI_CHAT_PLATFORMS, isAiDockVisible } from '@shared-core/constants/aiChatCatalog'
import { describe, expect, it } from 'vitest'

describe('AI chat catalogue integration', () => {
  it('exposes 50 web chat services in the browser registry with valid HTTPS URLs', () => {
    const browser = Object.values(WEB_AI_REGISTRY).filter((p) => !p.isSite && p.url)
    expect(browser).toHaveLength(50)
    expect(new Set(browser.map((p) => p.id)).size).toBe(50)
    for (const platform of browser) {
      expect(new URL(platform.url).protocol).toBe('https:')
    }
  })

  it('configures valid partitions on catalogue platforms', () => {
    for (const platform of Object.values(ADDITIONAL_AI_CHAT_PLATFORMS)) {
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
