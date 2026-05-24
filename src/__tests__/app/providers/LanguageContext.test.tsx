import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

vi.mock('@shared/lib/logger', () => ({
  Logger: {
    warn: vi.fn()
  }
}))

describe('LanguageContext & Zustand Store', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize language from localStorage if valid', async () => {
    localStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, 'en')
    const { useLanguage } = await import('@app/providers/LanguageContext')
    const { result } = renderHook(() => useLanguage())
    expect(result.current.language).toBe('en')
    expect(result.current.currentLanguage).toBeDefined()
  })

  it('should fallback to default language if localStorage has invalid value', async () => {
    localStorage.setItem(STORAGE_KEYS.APP_LANGUAGE, 'invalid-lang')
    const { useLanguage } = await import('@app/providers/LanguageContext')
    const { result } = renderHook(() => useLanguage())
    expect(result.current.language).toBe('tr') // default is 'tr'
  })

  it('should update language and save to localStorage on setLanguage with valid code', async () => {
    const { useLanguage } = await import('@app/providers/LanguageContext')
    const { result } = renderHook(() => useLanguage())

    act(() => {
      result.current.setLanguage('en')
    })

    expect(result.current.language).toBe('en')
    expect(localStorage.getItem(STORAGE_KEYS.APP_LANGUAGE)).toBe('en')
  })

  it('should ignore setLanguage with invalid language codes', async () => {
    const { useLanguage } = await import('@app/providers/LanguageContext')
    const { result } = renderHook(() => useLanguage())

    act(() => {
      result.current.setLanguage('tr') // Reset to tr
      result.current.setLanguage('fr') // Invalid, should be ignored
    })

    expect(result.current.language).toBe('tr')
  })

  it('should translate keys correctly using t', async () => {
    const { useLanguage } = await import('@app/providers/LanguageContext')
    const { result } = renderHook(() => useLanguage())

    act(() => {
      result.current.setLanguage('tr')
    })

    const welcomeText = result.current.t('cancel')
    expect(welcomeText).toBeDefined()
    expect(welcomeText).not.toBe('cancel')
    expect(welcomeText).toBe('Vazgeç') // In Turkish, 'cancel' is 'Vazgeç'
  })

  it('should handle deeply nested translation paths and fallback to raw key if missing', async () => {
    const { useLanguage } = await import('@app/providers/LanguageContext')
    const { result } = renderHook(() => useLanguage())

    const missingText = result.current.t('nonexistent.nested.path')
    expect(missingText).toBe('nonexistent.nested.path')
  })

  it('should successfully interpolate parameters', async () => {
    const { useLanguage } = await import('@app/providers/LanguageContext')
    const { result } = renderHook(() => useLanguage())

    act(() => {
      result.current.setLanguage('en')
    })

    const message = result.current.t('ai_error_title', { name: 'ChatGPT' })
    expect(message).toBe('Error: ChatGPT')

    act(() => {
      result.current.setLanguage('tr')
    })

    const messageTr = result.current.t('ai_error_title', { name: 'ChatGPT' })
    expect(messageTr).toBe('ChatGPT Hatası')
  })

  it('should provide useLanguageStrings helper hook', async () => {
    const { useLanguageStrings } = await import('@app/providers/LanguageContext')
    const { result } = renderHook(() => useLanguageStrings())
    expect(result.current.t).toBeDefined()
    expect(result.current.language).toBeDefined()
  })
})
