import SettingsLoadingSpinner from '@ui/layout/BottomBar/SettingsLoadingSpinner'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

describe('SettingsLoadingSpinner', () => {
  it('renders overlay correctly', () => {
    render(<SettingsLoadingSpinner />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })
})
