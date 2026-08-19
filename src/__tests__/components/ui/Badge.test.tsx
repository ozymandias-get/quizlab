import { Badge } from '@app/components/ui/badge'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Badge component', () => {
  it('renders with default variant and children', () => {
    render(<Badge>Active</Badge>)
    const badge = screen.getByText('Active')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('data-slot', 'badge')
    expect(badge).toHaveClass('bg-primary')
  })

  it('renders with secondary, outline, and success variants', () => {
    const { rerender } = render(<Badge variant="secondary">Secondary</Badge>)
    expect(screen.getByText('Secondary')).toHaveClass('bg-secondary')

    rerender(<Badge variant="outline">Outline</Badge>)
    expect(screen.getByText('Outline')).toHaveClass('border-border')

    rerender(<Badge variant="success">Success</Badge>)
    expect(screen.getByText('Success')).toHaveClass('bg-emerald-500/10')
  })

  it('supports sm and lg size variants', () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>)
    expect(screen.getByText('Small')).toHaveClass('h-4')

    rerender(<Badge size="lg">Large</Badge>)
    expect(screen.getByText('Large')).toHaveClass('h-6')
  })
})
