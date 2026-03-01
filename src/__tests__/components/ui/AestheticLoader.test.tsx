import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import AestheticLoader from '@ui/components/AestheticLoader'

// Mock useLanguage
vi.mock('@app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

describe('AestheticLoader', () => {
    it('should render correctly', () => {
        render(<AestheticLoader />)
        expect(screen.getByText('app_name')).toBeInTheDocument()

        const loaderMsg = screen.getByText(/loader_msg_\d+/)
        expect(loaderMsg).toBeInTheDocument()
    })
})

