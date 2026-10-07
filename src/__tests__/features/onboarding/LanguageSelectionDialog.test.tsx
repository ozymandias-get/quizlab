import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockSetLanguage = vi.fn().mockResolvedValue(undefined)
const mockCompleteOnboarding = vi.fn()
const languageState = {
  language: 'en',
  isOnboardingDone: false,
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
  setLanguage: mockSetLanguage,
  completeOnboarding: mockCompleteOnboarding
}

vi.mock('@shared/stores/languageStore', () => ({
  useLanguage: Object.assign(
    (selector?: (state: typeof languageState) => unknown) =>
      selector ? selector(languageState) : languageState,
    {
      getState: () => ({ completeOnboarding: mockCompleteOnboarding, setLanguage: mockSetLanguage })
    }
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

  it('calls setLanguage and completeOnboarding on continue', async () => {
    render(<LanguageSelectionDialog />)
    fireEvent.click(screen.getByText('Türkçe'))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await vi.waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith('tr')
      expect(mockCompleteOnboarding).toHaveBeenCalled()
    })
  })

  // The dialog is the app's only entry gate, so it has to be unmountable: a
  // user who has already onboarded must not see it flash on every cold start.
  it('renders nothing once onboarding is done', () => {
    languageState.isOnboardingDone = true
    const { container } = render(<LanguageSelectionDialog />)
    expect(container.innerHTML).toBe('')
    languageState.isOnboardingDone = false
  })
})
