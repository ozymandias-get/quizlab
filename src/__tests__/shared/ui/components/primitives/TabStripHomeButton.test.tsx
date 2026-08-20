/**
 * Tests for src/shared/ui/components/primitives/TabStripHomeButton.tsx
 *
 * The tooltip text is exposed as the accessible name by ToolbarButton
 * and rendered via the Tooltip primitive on hover.
 */
import { TabStripHomeButton } from '@shared/ui/components/primitives/TabStripHomeButton'

import { TooltipProvider } from '@app/components/ui/tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('TabStripHomeButton', () => {
  it('renders a button with the given tooltip as accessible name', () => {
    render(
      <TooltipProvider>
        <TabStripHomeButton tooltip="Go home" />
      </TooltipProvider>
    )
    expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
  })

  it('fires onClick when clicked', () => {
    const onClick = vi.fn()
    render(
      <TooltipProvider>
        <TabStripHomeButton tooltip="Home" onClick={onClick} />
      </TooltipProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
