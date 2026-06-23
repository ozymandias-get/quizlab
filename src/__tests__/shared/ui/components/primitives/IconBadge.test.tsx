/**
 * Tests for src/shared/ui/components/primitives/IconBadge.tsx
 */
import { IconBadge } from '@shared/ui/components/primitives/IconBadge'

import { render } from '@testing-library/react'
import { Home } from 'lucide-react'
import { describe, expect, it } from 'vitest'

describe('IconBadge', () => {
  it('renders the icon', () => {
    const { container } = render(<IconBadge icon={Home} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies the primary variant by default', () => {
    const { container } = render(<IconBadge icon={Home} />)
    expect(container.firstChild).toHaveClass('bg-primary/10')
  })

  it('applies the success variant', () => {
    const { container } = render(<IconBadge icon={Home} variant="success" />)
    expect(container.firstChild).toHaveClass('bg-emerald-500/10')
  })

  it('applies the danger variant', () => {
    const { container } = render(<IconBadge icon={Home} variant="danger" />)
    expect(container.firstChild).toHaveClass('bg-destructive/10')
  })

  it('applies the md size by default', () => {
    const { container } = render(<IconBadge icon={Home} />)
    expect(container.firstChild).toHaveClass('w-10 h-10')
  })

  it('applies the sm size', () => {
    const { container } = render(<IconBadge icon={Home} size="sm" />)
    expect(container.firstChild).toHaveClass('w-6 h-6')
  })

  it('applies the xl size', () => {
    const { container } = render(<IconBadge icon={Home} size="xl" />)
    expect(container.firstChild).toHaveClass('w-16 h-16')
  })

  it('applies custom className', () => {
    const { container } = render(<IconBadge icon={Home} className="my-custom" />)
    expect(container.firstChild).toHaveClass('my-custom')
  })
})
