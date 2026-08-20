import { MenuItem, MenuSeparator, MenuSurface } from '@app/components/ui/menu'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('MenuSurface', () => {
  it('defaults to role="menu"', () => {
    render(<MenuSurface />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('accepts a role override', () => {
    render(<MenuSurface role="dialog" aria-label="More tabs" />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'More tabs')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders without a role when role={null}', () => {
    const { container } = render(<MenuSurface role={null} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(container.firstChild).not.toHaveAttribute('role')
  })
})

describe('MenuItem', () => {
  it('renders as a menuitem button', () => {
    render(<MenuItem>Rename</MenuItem>)
    const item = screen.getByRole('menuitem')
    expect(item).toHaveAttribute('type', 'button')
    expect(screen.getByText('Rename')).toBeInTheDocument()
  })

  it('renders shortcut text', () => {
    render(<MenuItem shortcut="Ctrl+S">Save</MenuItem>)
    expect(screen.getByText('Ctrl+S')).toBeInTheDocument()
  })
})

describe('MenuSeparator', () => {
  it('renders as a separator', () => {
    render(<MenuSeparator />)
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })
})
