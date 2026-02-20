import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { SettingsLoadingSpinner } from '@src/components/layout/BottomBar/SettingsLoadingSpinner'

// Mock useLanguage
vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

describe('SettingsLoadingSpinner', () => {
    it('renders overlay correctly', () => {
        render(<SettingsLoadingSpinner />)

        expect(screen.getByText('loading')).toBeInTheDocument()

        // Check for specific class for backdrop
        const overlay = screen.getByText('loading').closest('.fixed')
        expect(overlay).toBeInTheDocument()
        expect(overlay).toHaveClass('backdrop-blur-[2px]')
    })
})
