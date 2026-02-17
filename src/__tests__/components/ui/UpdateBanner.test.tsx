import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import UpdateBanner from '../../../components/ui/UpdateBanner'

// Mock icons
vi.mock('../../../components/ui/Icons', () => ({
    UpdateIcon: () => <div data-testid="icon-update" />,
    CloseIcon: () => <div data-testid="icon-close" />,
    DownloadIcon: () => <div data-testid="icon-download" />
}))

// Mock t function
const t = (key: string) => key

describe('UpdateBanner', () => {
    const defaultProps = {
        updateAvailable: true,
        updateInfo: { version: '1.2.3', releaseName: 'Cool Update' } as any,
        isVisible: true,
        onClose: vi.fn(),
        t
    }

    it('renders when visible and update available', () => {
        render(<UpdateBanner {...defaultProps} />)
        expect(screen.getByText('update_available')).toBeInTheDocument()
        expect(screen.getByText('1.2.3')).toBeInTheDocument()
        expect(screen.getByText('Cool Update')).toBeInTheDocument()
    })

    it('returns null if not visible', () => {
        const { container } = render(<UpdateBanner {...defaultProps} isVisible={false} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('returns null if no update info', () => {
        const { container } = render(<UpdateBanner {...defaultProps} updateInfo={null} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('calls onClose when closed', () => {
        render(<UpdateBanner {...defaultProps} />)
        const closeBtn = screen.getByTestId('icon-close').closest('button')
        fireEvent.click(closeBtn!)
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('calls onClose when Later clicked', () => {
        render(<UpdateBanner {...defaultProps} />)
        fireEvent.click(screen.getByText('later'))
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('handles download action', async () => {
        const openReleasesPage = vi.fn()
        window.electronAPI = { openReleasesPage } as any

        render(<UpdateBanner {...defaultProps} />)
        fireEvent.click(screen.getByText('download_from_github'))

        expect(openReleasesPage).toHaveBeenCalled()
    })
})
