import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SettingsCollectionTabShell from '@features/settings/ui/shared/SettingsCollectionTabShell'

describe('SettingsCollectionTabShell', () => {
    it('shows description only when the add form is collapsed', () => {
        const { rerender } = render(
            <SettingsCollectionTabShell
                icon={<span>Icon</span>}
                eyebrow="Eyebrow"
                title="Title"
                showAddForm={false}
                addLabel="Add"
                cancelLabel="Cancel"
                description="Description"
                addForm={<div>Form</div>}
                list={<div>List</div>}
                onToggleAddForm={() => undefined}
            />
        )

        expect(screen.getByText('Description')).toBeInTheDocument()
        expect(screen.getByText('Form')).toBeInTheDocument()
        expect(screen.getByText('List')).toBeInTheDocument()

        rerender(
            <SettingsCollectionTabShell
                icon={<span>Icon</span>}
                eyebrow="Eyebrow"
                title="Title"
                showAddForm={true}
                addLabel="Add"
                cancelLabel="Cancel"
                description="Description"
                addForm={<div>Form</div>}
                list={<div>List</div>}
                onToggleAddForm={() => undefined}
            />
        )

        expect(screen.queryByText('Description')).not.toBeInTheDocument()
    })
})
