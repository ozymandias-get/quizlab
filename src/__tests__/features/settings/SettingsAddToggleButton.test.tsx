import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SettingsAddToggleButton from '@features/settings/ui/shared/SettingsAddToggleButton'

describe('SettingsAddToggleButton', () => {
    it('shows the add label and icon when collapsed', () => {
        render(
            <SettingsAddToggleButton
                expanded={false}
                addLabel="Add model"
                cancelLabel="Cancel"
                onToggle={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: /add model/i })).toBeInTheDocument()
        expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    })

    it('shows the cancel label and triggers toggle when expanded', () => {
        const onToggle = vi.fn()

        render(
            <SettingsAddToggleButton
                expanded
                addLabel="Add model"
                cancelLabel="Cancel"
                onToggle={onToggle}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
        expect(onToggle).toHaveBeenCalledTimes(1)
    })
})
