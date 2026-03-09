import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SettingsTabHeader from '@features/settings/ui/shared/SettingsTabHeader'

describe('SettingsTabHeader', () => {
    it('renders its icon, labels, and action content', () => {
        render(
            <SettingsTabHeader
                icon={<span>Icon</span>}
                eyebrow="Eyebrow"
                title="Title"
                action={<button type="button">Action</button>}
            />
        )

        expect(screen.getByText('Icon')).toBeInTheDocument()
        expect(screen.getByText('Eyebrow')).toBeInTheDocument()
        expect(screen.getByText('Title')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    })
})
