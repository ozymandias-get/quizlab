/**
 * Tests for src/shared/ui/components/primitives/EmptyState.tsx
 */
import { EmptyState } from '@shared/ui/components/primitives/EmptyState'

import { render, screen } from '@testing-library/react'
import { Home } from 'lucide-react'
import { describe, expect, it } from 'vitest'

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No results found" />)
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('renders an icon when provided', () => {
    const { container } = render(<EmptyState title="Empty" icon={Home} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Nothing to show here" />)
    expect(screen.getByText('Nothing to show here')).toBeInTheDocument()
  })

  it('renders action content when provided', () => {
    render(<EmptyState title="Empty" action={<button>Add</button>} />)
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="Empty" className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('renders without icon when icon prop is omitted', () => {
    const { container } = render(<EmptyState title="Empty" />)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})
