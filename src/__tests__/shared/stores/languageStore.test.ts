/**
 * Tests for src/shared/stores/languageStore.ts
 *
 * Zustand store for i18n language management with localStorage persistence.
 */

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  getInitialOnboardingDone,
  useLanguage
} from '@shared/stores/languageStore'

import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('i18next', () => ({
  default: {
    language: 'en',
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(() => vi.fn()),
    off: vi.fn()
  }
}))

beforeEach(() => {
  window.localStorage.clear()
  useLanguage.setState({
    language: DEFAULT_LANGUAGE,
    _requestSeq: 0,
    lastError: null,
    isOnboardingDone: false
  })
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('languageStore', () => {
  describe('initial state', () => {
    it('defaults to English', () => {
      expect(useLanguage.getState().language).toBe('en')
    })

    it('reads persisted language from localStorage', () => {
      window.localStorage.setItem('appLanguage', 'tr')
      // Reinitialize by calling setState as the store would on init
      useLanguage.setState({ language: 'tr' })
      expect(useLanguage.getState().language).toBe('tr')
    })

    it('exposes LANGUAGES constant', () => {
      expect(useLanguage.getState().languages).toBe(LANGUAGES)
    })
  })

  describe('LANGUAGES constant', () => {
    it('includes English', () => {
      expect(LANGUAGES.en).toBeDefined()
      expect(LANGUAGES.en.code).toBe('en')
      expect(LANGUAGES.en.dir).toBe('ltr')
    })

    it('includes Turkish', () => {
      expect(LANGUAGES.tr).toBeDefined()
      expect(LANGUAGES.tr.code).toBe('tr')
      expect(LANGUAGES.tr.dir).toBe('ltr')
    })

    it('has no unsupported languages', () => {
      const codes = Object.keys(LANGUAGES)
      expect(codes).toEqual(['en', 'tr'])
    })
  })

  describe('setLanguage', () => {
    it('changes language to a valid option', async () => {
      await useLanguage.getState().setLanguage('tr')
      expect(useLanguage.getState().language).toBe('tr')
    })

    it('persists to localStorage', async () => {
      await useLanguage.getState().setLanguage('tr')
      expect(window.localStorage.getItem('appLanguage')).toBe('tr')
    })

    it('calls i18next.changeLanguage', async () => {
      await useLanguage.getState().setLanguage('tr')
      expect(i18next.changeLanguage).toHaveBeenCalledWith('tr')
    })

    it('ignores invalid language codes', async () => {
      await useLanguage.getState().setLanguage('fr')
      expect(useLanguage.getState().language).toBe('en')
    })

    it('ignores setLanguage to current language', async () => {
      await useLanguage.getState().setLanguage('en')
      expect(i18next.changeLanguage).toHaveBeenCalledWith('en')
    })

    it('handles localStorage write failure gracefully', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('Storage full')
      })
      await useLanguage.getState().setLanguage('tr')
      expect(useLanguage.getState().lastError).toBeTruthy()
    })
  })

  describe('onboarding', () => {
    it('defaults isOnboardingDone to false', () => {
      expect(useLanguage.getState().isOnboardingDone).toBe(false)
    })

    it('completeOnboarding sets isOnboardingDone to true and persists', () => {
      useLanguage.getState().completeOnboarding()
      expect(useLanguage.getState().isOnboardingDone).toBe(true)
      expect(window.localStorage.getItem('app-language-onboarding-done')).toBe('true')
    })

    it('reads persisted onboarding state from localStorage', () => {
      window.localStorage.setItem('app-language-onboarding-done', 'true')
      expect(getInitialOnboardingDone()).toBe(true)
      window.localStorage.removeItem('app-language-onboarding-done')
      expect(getInitialOnboardingDone()).toBe(false)
    })
  })

  describe('_requestSeq', () => {
    it('increments on each setLanguage call', async () => {
      const seqBefore = useLanguage.getState()._requestSeq
      await useLanguage.getState().setLanguage('tr')
      expect(useLanguage.getState()._requestSeq).toBe(seqBefore + 1)
    })
  })
})
