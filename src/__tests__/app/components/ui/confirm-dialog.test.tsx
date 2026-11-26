import { ConfirmDialog } from '@app/components/ui/confirm-dialog'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

describe('ConfirmDialog', () => {
  it('names the alertdialog by its title and description', async () => {
    render(
      <ConfirmDialog
        isOpen
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        title="Delete this item?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    )

    const dialog = screen.getByRole('alertdialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    const describedBy = dialog.getAttribute('aria-describedby')

    expect(document.getElementById(labelledBy ?? '')).toHaveTextContent('Delete this item?')
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
      'This action cannot be undone.'
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            Open confirmation
          </button>
          <ConfirmDialog
            isOpen={isOpen}
            onConfirm={vi.fn()}
            onCancel={() => setIsOpen(false)}
            title="Delete this item?"
            confirmLabel="Delete"
            cancelLabel="Cancel"
          />
        </>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open confirmation' })
    trigger.focus()
    fireEvent.click(trigger)

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    // Presence holds the behavior hook until the exit animation finishes, so
    // focus restoration lands with the same cleanup.
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  // A fixed backdrop is contained by an ancestor with a backdrop filter, so an
  // inline dialog inside the settings panel used to cover and clip to that
  // panel. The portal keeps the backdrop on the window.
  it('portals the backdrop to the body so a filtered ancestor cannot clip it', () => {
    render(
      <div style={{ backdropFilter: 'blur(4px)' }}>
        <ConfirmDialog
          isOpen
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          title="Delete this item?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
        />
      </div>
    )

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.parentElement?.parentElement).toBe(document.body)
  })

  it('holds the shared dialog registration until the exit animation ends', async () => {
    const props = {
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      title: 'Delete this item?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    }
    const { rerender } = render(<ConfirmDialog isOpen {...props} />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<ConfirmDialog isOpen={false} {...props} />)
    // The panel is still animating out, so the registry must not release yet.
    expect(document.body.style.overflow).toBe('hidden')

    await waitFor(() => expect(document.body.style.overflow).toBe(''))
  })
})
