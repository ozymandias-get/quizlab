import type { AiPlatform } from '@shared-core/types'

import {
  isCustomModelPlatform,
  isCustomSitePlatform,
  isManagedGooglePlatform,
  MANAGED_GOOGLE_PLATFORM_IDS
} from '@features/settings/ui/shared/aiPlatformFilters'

import { describe, expect, it } from 'vitest'

describe('MANAGED_GOOGLE_PLATFORM_IDS', () => {
  it('should include all managed Google platform IDs', () => {
    expect(MANAGED_GOOGLE_PLATFORM_IDS).toContain('gemini')
    expect(MANAGED_GOOGLE_PLATFORM_IDS).not.toContain('notebooklm')
    expect(MANAGED_GOOGLE_PLATFORM_IDS).toContain('aistudio')
    expect(MANAGED_GOOGLE_PLATFORM_IDS).toContain('youtube')
  })

  it('should have exactly 3 entries', () => {
    expect(MANAGED_GOOGLE_PLATFORM_IDS.length).toBe(3)
  })
})

describe('isManagedGooglePlatform', () => {
  it('should return true for gemini', () => {
    expect(isManagedGooglePlatform('gemini')).toBe(true)
  })

  it('should return false for notebooklm', () => {
    expect(isManagedGooglePlatform('notebooklm')).toBe(false)
  })

  it('should return true for aistudio', () => {
    expect(isManagedGooglePlatform('aistudio')).toBe(true)
  })

  it('should return true for youtube', () => {
    expect(isManagedGooglePlatform('youtube')).toBe(true)
  })

  it('should return false for openai', () => {
    expect(isManagedGooglePlatform('openai')).toBe(false)
  })

  it('should return false for custom', () => {
    expect(isManagedGooglePlatform('custom')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isManagedGooglePlatform('')).toBe(false)
  })
})

describe('isCustomModelPlatform', () => {
  it('should return true for non-site, non-Google platform', () => {
    const platform = { id: 'openai', isSite: false } as AiPlatform
    expect(isCustomModelPlatform(platform)).toBe(true)
  })

  it('should return false for managed Google platform', () => {
    const platform = { id: 'gemini', isSite: false } as AiPlatform
    expect(isCustomModelPlatform(platform)).toBe(false)
  })

  it('should return false for site platforms', () => {
    const platform = { id: 'custom-site', isSite: true } as AiPlatform
    expect(isCustomModelPlatform(platform)).toBe(false)
  })

  it('should return false for Google site platforms', () => {
    const platform = { id: 'gemini', isSite: true } as AiPlatform
    expect(isCustomModelPlatform(platform)).toBe(false)
  })
})

describe('isCustomSitePlatform', () => {
  it('should return true for non-Google site platform', () => {
    const platform = { id: 'chatgpt', isSite: true } as AiPlatform
    expect(isCustomSitePlatform(platform)).toBe(true)
  })

  it('should return false for managed Google platform', () => {
    const platform = { id: 'gemini', isSite: true } as AiPlatform
    expect(isCustomSitePlatform(platform)).toBe(false)
  })

  it('should return false for non-site platforms', () => {
    const platform = { id: 'openai', isSite: false } as AiPlatform
    expect(isCustomSitePlatform(platform)).toBe(false)
  })

  it('should return false for non-Google non-site platforms', () => {
    const platform = { id: 'anthropic', isSite: false } as AiPlatform
    expect(isCustomSitePlatform(platform)).toBe(false)
  })

  it('should return false for unknown platform that is not Google managed', () => {
    const platform = { id: 'unknown', isSite: false } as AiPlatform
    expect(isCustomSitePlatform(platform)).toBe(false)
  })
})
