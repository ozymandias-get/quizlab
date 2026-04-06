import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AppBackground from '@ui/layout/AppBackground'

vi.mock('@app/providers', () => ({
  useAppearance: vi.fn()
}))

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

import { useAppearance } from '@app/providers'

describe('AppBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders solid background when bgType is solid', () => {
    vi.mocked(useAppearance).mockReturnValue({
      bgType: 'solid',
      bgSolidColor: '#123456',
      bgAnimatedColors: [],
      bgRandomMode: false
    })

    const { container } = render(<AppBackground />)

    const bgDiv = container.firstChild as HTMLElement
    expect(bgDiv).toHaveStyle({ backgroundColor: '#123456' })

    expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument()
  })

  it('renders animated blobs when bgType is animated', () => {
    vi.mocked(useAppearance).mockReturnValue({
      bgType: 'animated',
      bgSolidColor: '#000000',
      bgAnimatedColors: ['#ff0000', '#00ff00'],
      bgRandomMode: false
    })

    render(<AppBackground />)

    const blobs = screen.getAllByTestId('motion-div')
    expect(blobs.length).toBeGreaterThan(0)
  })
})
