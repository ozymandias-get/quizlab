import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SettingsTabIntro from '@features/settings/ui/shared/SettingsTabIntro'

describe('SettingsTabIntro', () => {
  it('renders header content, action, and description', () => {
    render(
      <SettingsTabIntro
        icon={<span>Icon</span>}
        eyebrow="Eyebrow"
        title="Title"
        description="Description"
        action={<button type="button">Action</button>}
      />
    )

    expect(screen.getByText('Icon')).toBeInTheDocument()
    expect(screen.getByText('Eyebrow')).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('hides the description when requested', () => {
    render(
      <SettingsTabIntro
        icon={<span>Icon</span>}
        eyebrow="Eyebrow"
        title="Title"
        description="Description"
        hideDescription={true}
      />
    )

    expect(screen.queryByText('Description')).not.toBeInTheDocument()
  })
})
