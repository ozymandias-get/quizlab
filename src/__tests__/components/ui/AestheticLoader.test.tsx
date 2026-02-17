import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import AestheticLoader from '../../../components/ui/AestheticLoader'

// Mock useLanguage
vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

describe('AestheticLoader', () => {
    it('should render correctly', () => {
        render(<AestheticLoader />)
        expect(screen.getByText('app_name')).toBeInTheDocument()
        expect(screen.getByText('loader_syncing')).toBeInTheDocument()
    })
})
