/**
 * Tests for src/shared/ui/components/primitives/tooltip.tsx
 *
 * Radix closes tooltips from the trigger's pointer events. If the trigger is
 * replaced while hovered (or a native view swallows the pointer), that event
 * never arrives and the bubble stays frozen on screen. The primitive adds
 * shared document listeners so any real interaction dismisses it — these tests
 * pin that safety net.
 */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@shared/ui/components/primitives'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function renderOpenTooltip() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Tooltip defaultOpen>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Hint</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

describe('Tooltip', () => {
  it('renders an open tooltip bubble', () => {
    renderOpenTooltip()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hint')
  })

  it('stays open while the pointer is still over the trigger', () => {
    renderOpenTooltip()
    const trigger = screen.getByText('Trigger')

    fireEvent.pointerMove(trigger)

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('closes when the pointer moves outside the trigger and bubble', () => {
    renderOpenTooltip()

    fireEvent.pointerMove(document.body)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes when the window loses focus', () => {
    renderOpenTooltip()

    fireEvent.blur(window)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderOpenTooltip()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
