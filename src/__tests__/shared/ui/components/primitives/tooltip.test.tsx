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

  it('closes when the pointer leaves the document (native view / window edge)', () => {
    renderOpenTooltip()

    // `relatedTarget === null` means no pointermove will follow inside the
    // document: the cursor crossed into an overlaid native view or left the
    // window. Waiting for a pointermove would leave the bubble frozen.
    fireEvent.pointerOut(document.body, { relatedTarget: null })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes a disabled trigger and does not reopen it on re-enable', () => {
    const { rerender } = render(
      <TooltipProvider delayDuration={0}>
        <Tooltip defaultOpen>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    const renderTooltip = (disabled: boolean) => (
      <TooltipProvider delayDuration={0}>
        <Tooltip defaultOpen disabled={disabled}>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    rerender(renderTooltip(true))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    // The stored open state was reset, not just hidden: a trigger that becomes
    // enabled again must not resurrect a bubble with no hover behind it.
    rerender(renderTooltip(false))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderOpenTooltip()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
