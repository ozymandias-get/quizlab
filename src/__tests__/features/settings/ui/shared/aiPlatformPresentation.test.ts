import { getAiPlatformLabel } from '@features/settings/ui/shared/aiPlatformPresentation'

import { describe, expect, it, vi } from 'vitest'

vi.mock('@ui/components/Icons', () => ({
  getAiIcon: vi.fn(() => null)
}))

describe('getAiPlatformLabel', () => {
  it('should return translation when t function provides a valid translation', () => {
    const t = (key: string) => {
      if (key === 'openai') return 'OpenAI Translation'
      return key
    }
    const result = getAiPlatformLabel(undefined, 'openai', t)
    expect(result).toBe('OpenAI Translation')
  })

  it('should return fallbackKey capitalized when t function returns same key', () => {
    const t = (key: string) => key
    const result = getAiPlatformLabel(undefined, 'openai', t)
    expect(result).toBe('Openai')
  })

  it('should return displayName from platform when no translation available', () => {
    const platform = { displayName: 'My Custom Platform', name: 'custom' }
    const result = getAiPlatformLabel(platform, 'openai')
    expect(result).toBe('My Custom Platform')
  })

  it('should return name from platform when displayName is missing', () => {
    const platform = { name: 'custom-model' }
    const result = getAiPlatformLabel(platform, 'openai')
    expect(result).toBe('custom-model')
  })

  it('should return capitalized fallbackKey when platform is undefined', () => {
    const result = getAiPlatformLabel(undefined, 'openai')
    expect(result).toBe('Openai')
  })

  it('should return capitalized fallbackKey when platform has neither displayName nor name', () => {
    const platform = {} as any
    const result = getAiPlatformLabel(platform, 'chatgpt')
    expect(result).toBe('Chatgpt')
  })

  it('should prefer translation over platform name', () => {
    const t = (key: string) => {
      if (key === 'openai') return 'AI Provider'
      return key
    }
    const platform = { displayName: 'OpenAI Official', name: 'openai' }
    const result = getAiPlatformLabel(platform, 'openai', t)
    expect(result).toBe('AI Provider')
  })
})
