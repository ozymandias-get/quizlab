/**
 * Tests for src/shared/ui/components/primitives/TabStripHomeButton.tsx
 *
 * The tooltip text is rendered as a `title` attribute by ToolbarButton.
 */
import { TabStripHomeButton } from '@shared/ui/components/primitives/TabStripHomeButton'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('TabStripHomeButton', () => {
  it('renders a button with the given tooltip as title', () => {
    render(<TabStripHomeButton tooltip="Go home" />)
    expect(screen.getByTitle('Go home')).toBeInTheDocument()
  })

  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    render(<TabStripHomeButton tooltip="Home" onClick={onClick} />)
    fireEvent.click(screen.getByTitle('Home'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
