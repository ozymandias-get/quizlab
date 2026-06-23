import { isVisionCapable, VISION_MODEL_PATTERNS } from '@features/ai/lib/apiChatUtils'

import { describe, expect, it } from 'vitest'

describe('VISION_MODEL_PATTERNS', () => {
  it('should contain regex patterns for all known vision-capable models', () => {
    expect(VISION_MODEL_PATTERNS.length).toBeGreaterThanOrEqual(7)
  })

  it('should match gpt-4o variants', () => {
    expect(VISION_MODEL_PATTERNS[0].test('gpt-4o')).toBe(true)
    expect(VISION_MODEL_PATTERNS[0].test('GPT-4o-mini')).toBe(true)
    expect(VISION_MODEL_PATTERNS[0].test('gpt-4o-2024-08-06')).toBe(true)
  })

  it('should match gpt-4.x-turbo variants', () => {
    expect(VISION_MODEL_PATTERNS[1].test('gpt-4.0-turbo')).toBe(true)
    expect(VISION_MODEL_PATTERNS[1].test('gpt-4.1-turbo')).toBe(true)
    expect(VISION_MODEL_PATTERNS[1].test('GPT-4.2-TURBO')).toBe(true)
  })
})

describe('isVisionCapable', () => {
  describe('GPT-4o models', () => {
    it('should return true for gpt-4o', () => {
      expect(isVisionCapable('gpt-4o')).toBe(true)
    })

    it('should return true for gpt-4o-mini', () => {
      expect(isVisionCapable('gpt-4o-mini')).toBe(true)
    })

    it('should return true for gpt-4o-2024-08-06', () => {
      expect(isVisionCapable('gpt-4o-2024-08-06')).toBe(true)
    })

    it('should be case-insensitive for GPT-4o', () => {
      expect(isVisionCapable('GPT-4o')).toBe(true)
    })
  })

  describe('GPT-4.x-turbo models', () => {
    it('should return true for gpt-4.0-turbo', () => {
      expect(isVisionCapable('gpt-4.0-turbo')).toBe(true)
    })

    it('should return true for gpt-4.1-turbo', () => {
      expect(isVisionCapable('gpt-4.1-turbo')).toBe(true)
    })
  })

  describe('Claude models', () => {
    it('should return true for claude-3-5-sonnet', () => {
      expect(isVisionCapable('claude-3-5-sonnet')).toBe(true)
    })

    it('should return true for claude-3-opus', () => {
      expect(isVisionCapable('claude-3-opus')).toBe(true)
    })

    it('should be case-insensitive for CLAUDE-3-5', () => {
      expect(isVisionCapable('CLAUDE-3-5-sonnet')).toBe(true)
    })
  })

  describe('Gemini models', () => {
    it('should return true for gemini-1.5-pro', () => {
      expect(isVisionCapable('gemini-1.5-pro')).toBe(true)
    })

    it('should return true for gemini-2.0-flash', () => {
      expect(isVisionCapable('gemini-2.0-flash')).toBe(true)
    })

    it('should return true for gemini-1.5-flash', () => {
      expect(isVisionCapable('gemini-1.5-flash')).toBe(true)
    })

    it('should return true for gemini-2.5-pro', () => {
      expect(isVisionCapable('gemini-2.5-pro')).toBe(true)
    })
  })

  describe('non-vision models', () => {
    it('should return false for gpt-3.5-turbo', () => {
      expect(isVisionCapable('gpt-3.5-turbo')).toBe(false)
    })

    it('should return false for claude-2.1', () => {
      expect(isVisionCapable('claude-2.1')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isVisionCapable('')).toBe(false)
    })

    it('should return false for random text', () => {
      expect(isVisionCapable('some-random-model')).toBe(false)
    })
  })
})
