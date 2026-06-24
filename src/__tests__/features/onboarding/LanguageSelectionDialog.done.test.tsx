import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@shared/stores/languageStore', () => ({
  useLanguage: Object.assign(
    (selector?: (state: any) => any) => {
      const state = {
        language: 'en',
        isOnboardingDone: true,
        languages: {
          en: {
            code: 'en',
            name: 'English',
            nativeName: 'English',
            flag: '🇬🇧',
            dir: 'ltr' as const
          },
          tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', dir: 'ltr' as const }
        },
        setLanguage: vi.fn().mockResolvedValue(undefined),
        completeOnboarding: vi.fn()
      }
      return selector ? selector(state) : state
    },
    { getState: () => ({}) }
  )
}))

import { LanguageSelectionDialog } from '@features/onboarding/ui/LanguageSelectionDialog'

describe('LanguageSelectionDialog (onboarding done)', () => {
  it('renders nothing when onboarding is done', () => {
    const { container } = render(<LanguageSelectionDialog />)
    expect(container.innerHTML).toBe('')
  })
})
