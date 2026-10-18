import SettingsAddToggleButton from '@features/settings/ui/shared/SettingsAddToggleButton'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('SettingsAddToggleButton', () => {
  // One branch: `expanded` swaps the add label for the cancel label, and both
  // states must fire the same toggle handler.
  it('swaps between the add and cancel labels and toggles from either', () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <SettingsAddToggleButton
        expanded={false}
        addLabel="Add model"
        cancelLabel="Cancel"
        onToggle={onToggle}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /add model/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)

    rerender(
      <SettingsAddToggleButton
        expanded
        addLabel="Add model"
        cancelLabel="Cancel"
        onToggle={onToggle}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onToggle).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Add model')).not.toBeInTheDocument()
  })
})
