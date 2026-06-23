/**
 * Tests for src/platform/electron/web-ai-registry.ts
 *
 * Validates the static AI platform registry entries.
 */
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'

import { describe, expect, it } from 'vitest'

describe('webAiRegistry', () => {
  it('exports a non-empty registry', () => {
    expect(Object.keys(WEB_AI_REGISTRY).length).toBeGreaterThan(0)
  })

  it('every entry has the required AiPlatform shape', () => {
    for (const [id, platform] of Object.entries(WEB_AI_REGISTRY)) {
      expect(platform.id).toBe(id)
      expect(platform.name).toBeTruthy()
      expect(platform.displayName).toBeTruthy()
      expect(typeof platform.url).toBe('string')
      expect(platform.color).toMatch(/^#[\dA-Fa-f]{6}$/)
      expect(['enter_key', 'click', 'mixed']).toContain(platform.submitMode)
    }
  })

  it('no two entries share the same name', () => {
    const names = Object.values(WEB_AI_REGISTRY).map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('no two entries share the same url (excluding empty urls)', () => {
    const urls = Object.values(WEB_AI_REGISTRY)
      .map((p) => p.url)
      .filter(Boolean)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('includes well-known platforms', () => {
    expect(WEB_AI_REGISTRY).toHaveProperty('chatgpt')
    expect(WEB_AI_REGISTRY).toHaveProperty('gemini')
    expect(WEB_AI_REGISTRY).toHaveProperty('claude')
    expect(WEB_AI_REGISTRY).toHaveProperty('api-chat')
  })

  it('chatgpt uses mixed submit mode', () => {
    expect(WEB_AI_REGISTRY.chatgpt.submitMode).toBe('mixed')
  })

  it('api-chat has an empty url', () => {
    expect(WEB_AI_REGISTRY['api-chat'].url).toBe('')
  })

  it('youtube is marked as a site', () => {
    expect(WEB_AI_REGISTRY.youtube.isSite).toBe(true)
  })
})
