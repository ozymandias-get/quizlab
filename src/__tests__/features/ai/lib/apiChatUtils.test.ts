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

  // Regression: the allowlist used to stop at gpt-4o/claude-3-5/gemini-2, so
  // the attachment button was simply not rendered for most current models.
  describe('modern OpenAI models', () => {
    it.each([
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4.5-preview',
      'gpt-5',
      'gpt-5-mini',
      'gpt-5.1',
      'o1',
      'o1-mini',
      'o3',
      'o3-mini',
      'o4-mini'
    ])('should return true for %s', (model) => {
      expect(isVisionCapable(model)).toBe(true)
    })

    it('should return false for text-only gpt-3.5 and gpt-4 base ids', () => {
      expect(isVisionCapable('gpt-3.5-turbo')).toBe(false)
      expect(isVisionCapable('gpt-3.5')).toBe(false)
      expect(isVisionCapable('gpt-40')).toBe(false)
    })
  })

  describe('modern Anthropic models', () => {
    it.each([
      'claude-3-7-sonnet-20250219',
      'claude-3-5-haiku-latest',
      'claude-sonnet-4-20250514',
      'claude-sonnet-4-5',
      'claude-opus-4-1',
      'claude-haiku-4-5',
      'claude-4-opus'
    ])('should return true for %s', (model) => {
      expect(isVisionCapable(model)).toBe(true)
    })

    it('should return false for claude-2.x', () => {
      expect(isVisionCapable('claude-2.1')).toBe(false)
      expect(isVisionCapable('claude-2')).toBe(false)
    })
  })

  describe('modern Gemini models', () => {
    it.each(['gemini-3-pro', 'gemini-2.5-flash', 'gemini-2.5-pro-latest', 'gemini-1.5-flash'])(
      'should return true for %s',
      (model) => {
        expect(isVisionCapable(model)).toBe(true)
      }
    )
  })

  describe('local / open-weight vision models', () => {
    it.each([
      'llava',
      'llava:13b',
      'llava-llama3',
      'bakllava',
      'moondream',
      'moondream2',
      'llama3.2-vision',
      'llama-3.2-11b-vision-instruct',
      'qwen2-vl',
      'qwen2.5-vl-7b-instruct',
      'minicpm-v',
      'gemma3:4b',
      'internvl3-8b',
      'phi-3.5-vision-instruct',
      'glm-4v',
      'pixtral-12b'
    ])('should return true for %s', (model) => {
      expect(isVisionCapable(model)).toBe(true)
    })
  })

  describe('guard rails', () => {
    it('should not treat a bare "vl" substring inside a word as vision support', () => {
      expect(isVisionCapable('my-vllm-text-model')).toBe(false)
    })

    it('should return false for an undefined-ish runtime value', () => {
      expect(isVisionCapable(undefined as unknown as string)).toBe(false)
      expect(isVisionCapable(null as unknown as string)).toBe(false)
    })
  })
})
