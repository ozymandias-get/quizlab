import { STORAGE_KEYS } from '@shared/constants/storageKeys'

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/logger', () => ({
  Logger: { warn: vi.fn() }
}))

describe('languageStore & Zustand Store', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize language from localStorage if valid', async () => {
    localStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, 'en')
    const { useLanguage } = await import('@shared/stores/languageStore')
    const { result } = renderHook(() => useLanguage())
    expect(result.current.language).toBe('en')
  })

  it('should fallback to default language if localStorage has invalid value', async () => {
    localStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, 'invalid-lang')
    const { useLanguage } = await import('@shared/stores/languageStore')
    const { result } = renderHook(() => useLanguage())
    expect(result.current.language).toBe('en')
  })

  it('provides languages list via store', async () => {
    const { useLanguage } = await import('@shared/stores/languageStore')
    const { result } = renderHook(() => useLanguage())
    expect(result.current.languages).toBeDefined()
    expect(result.current.languages.en).toBeDefined()
    expect(result.current.languages.tr).toBeDefined()
  })
})
