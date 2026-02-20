import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AppBackground from '@src/components/layout/AppBackground'

// Mock dependencies
vi.mock('@src/app/providers', () => ({
    useAppearance: vi.fn()
}))

// Mock framer-motion because it uses requestAnimationFrame which might be tricky
// But here we want to test if blobs are rendered when mode is animated
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, style, ...props }: any) => (
            <div className={className} style={style} data-testid="motion-div" {...props}>
                {children}
            </div>
        )
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}))

import { useAppearance } from '@src/app/providers'

describe('AppBackground', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders solid background when bgType is solid', () => {
        (useAppearance as any).mockReturnValue({
            bgType: 'solid',
            bgSolidColor: '#123456',
            bgAnimatedColors: [],
            bgRandomMode: false
        })

        const { container } = render(<AppBackground />)

        // The container div should have the background color style
        const bgDiv = container.firstChild as HTMLElement
        expect(bgDiv).toHaveStyle({ backgroundColor: '#123456' })

        // Should not render blobs
        expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument()
    })

    it('renders animated blobs when bgType is animated', () => {
        (useAppearance as any).mockReturnValue({
            bgType: 'animated',
            bgSolidColor: '#000000',
            bgAnimatedColors: ['#ff0000', '#00ff00'],
            bgRandomMode: false
        })

        render(<AppBackground />)

        // Should render blobs (RandomBlob uses motion.div)
        const blobs = screen.getAllByTestId('motion-div')
        expect(blobs.length).toBeGreaterThan(0)
    })
})
