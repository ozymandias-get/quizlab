import { isVisionCapable, VISION_MODEL_PATTERNS } from '@features/ai/lib/apiChatUtils'

import { describe, expect, it } from 'vitest'

describe('VISION_MODEL_PATTERNS', () => {
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
  // The legacy families that predate the modern allowlist. Kept as an explicit
  // table because the case-insensitivity of each family is part of the contract.
  describe('legacy model families', () => {
    it.each([
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4o-2024-08-06',
      'GPT-4o',
      'gpt-4.0-turbo',
      'gpt-4.1-turbo',
      'claude-3-5-sonnet',
      'claude-3-opus',
      'CLAUDE-3-5-sonnet',
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-pro'
    ])('should return true for %s', (model) => {
      expect(isVisionCapable(model)).toBe(true)
    })

    it.each(['gpt-3.5-turbo', 'claude-2.1', 'some-random-model'])(
      'should return false for %s',
      (model) => {
        expect(isVisionCapable(model)).toBe(false)
      }
    )

    it('should return false for an empty string', () => {
      expect(isVisionCapable('')).toBe(false)
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
      expect(isVisionCapable('claude-2')).toBe(false)
    })
  })

  describe('modern Gemini models', () => {
    it.each(['gemini-3-pro', 'gemini-2.5-flash', 'gemini-2.5-pro-latest'])(
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

    it.each(['text-davinci-003', 'gemini-pro'])(
      'should return false for the non-vision id %j',
      (id) => {
        expect(isVisionCapable(id)).toBe(false)
      }
    )
  })
})
