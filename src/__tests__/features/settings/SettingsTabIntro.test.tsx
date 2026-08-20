import SettingsTabIntro from '@features/settings/ui/shared/SettingsTabIntro'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('SettingsTabIntro', () => {
  it('renders icon, description, and action', () => {
    render(
      <SettingsTabIntro
        icon={<span>Icon</span>}
        description="Description"
        action={<button type="button">Action</button>}
      />
    )

    expect(screen.getByText('Icon')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('hides the description when requested', () => {
    render(<SettingsTabIntro icon={<span>Icon</span>} description="Description" hideDescription />)

    expect(screen.queryByText('Description')).not.toBeInTheDocument()
  })
})
