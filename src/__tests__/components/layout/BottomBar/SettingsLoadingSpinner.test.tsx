import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { SettingsLoadingSpinner } from '@ui/layout/BottomBar/SettingsLoadingSpinner'

vi.mock('@app/providers', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
  useLanguageStrings: () => ({ t: (key: string) => key, language: 'en' })
}))

describe('SettingsLoadingSpinner', () => {
  it('renders overlay correctly', () => {
    render(<SettingsLoadingSpinner />)

    expect(screen.getByText('loading')).toBeInTheDocument()

    const overlay = screen.getByText('loading').closest('.fixed')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass('backdrop-blur-[2px]')
  })
})
