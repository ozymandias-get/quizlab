import { Kbd } from '@app/components/ui/kbd'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Kbd component', () => {
  it('renders children with default styling', () => {
    render(<Kbd>Ctrl+F</Kbd>)
    const kbd = screen.getByText('Ctrl+F')
    expect(kbd).toBeInTheDocument()
    expect(kbd.tagName.toLowerCase()).toBe('kbd')
    expect(kbd).toHaveAttribute('data-slot', 'kbd')
    expect(kbd).toHaveClass('font-mono')
  })

  it('applies outline variant and size variants correctly', () => {
    const { rerender } = render(
      <Kbd variant="outline" size="xs">
        Esc
      </Kbd>
    )
    const kbd = screen.getByText('Esc')
    expect(kbd).toHaveClass('bg-background')
    expect(kbd).toHaveClass('text-ql-10')

    rerender(<Kbd size="sm">Enter</Kbd>)
    expect(screen.getByText('Enter')).toHaveClass('text-ql-11')
  })
})
