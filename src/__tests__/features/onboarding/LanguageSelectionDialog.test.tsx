import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockSetLanguage = vi.fn().mockResolvedValue(undefined)
const mockCompleteOnboarding = vi.fn()

vi.mock('@shared/stores/languageStore', () => ({
  useLanguage: Object.assign(
    (selector?: (state: any) => any) => {
      const state = {
        language: 'en',
        isOnboardingDone: false,
        languages: {
          en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' as const },
          tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', dir: 'ltr' as const }
        },
        setLanguage: mockSetLanguage,
        completeOnboarding: mockCompleteOnboarding
      }
      return selector ? selector(state) : state
    },
    { getState: () => ({ completeOnboarding: mockCompleteOnboarding, setLanguage: mockSetLanguage }) }
  )
}))

import { LanguageSelectionDialog } from '@features/onboarding/ui/LanguageSelectionDialog'

describe('LanguageSelectionDialog', () => {
  it('renders two language options', () => {
    render(<LanguageSelectionDialog />)
    expect(screen.getAllByText('English')).toHaveLength(2)
    expect(screen.getByText('Türkçe')).toBeInTheDocument()
  })

  it('continue button is disabled when no language selected', () => {
    render(<LanguageSelectionDialog />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('selecting a language enables the continue button', () => {
    render(<LanguageSelectionDialog />)
    fireEvent.click(screen.getByText('Türkçe'))
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
  })

  it('has role="dialog" and aria-modal', () => {
    render(<LanguageSelectionDialog />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})
