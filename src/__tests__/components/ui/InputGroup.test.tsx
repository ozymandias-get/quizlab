import { Input } from '@app/components/ui/input'
import { InputGroup, InputGroupAddon } from '@app/components/ui/input-group'

import { render, screen } from '@testing-library/react'
import { Search } from 'lucide-react'
import { describe, expect, it } from 'vitest'

describe('InputGroup component', () => {
  it('renders InputGroup with addon and input child', () => {
    render(
      <InputGroup data-testid="test-group">
        <InputGroupAddon align="inline-start">
          <Search data-testid="search-icon" />
        </InputGroupAddon>
        <Input placeholder="Search here..." />
      </InputGroup>
    )

    expect(screen.getByTestId('test-group')).toHaveAttribute('data-slot', 'input-group')
    expect(screen.getByTestId('search-icon')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search here...')).toBeInTheDocument()
  })

  it('handles inline-end alignment for addon', () => {
    render(
      <InputGroup>
        <Input placeholder="With suffix" />
        <InputGroupAddon align="inline-end" data-testid="end-addon">
          <span>Suffix</span>
        </InputGroupAddon>
      </InputGroup>
    )

    const addon = screen.getByTestId('end-addon')
    expect(addon).toHaveAttribute('data-align', 'inline-end')
    expect(addon).toHaveClass('right-2.5')
  })
})
