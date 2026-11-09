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
    expect(trigger).toHaveFocus()
  })
})
