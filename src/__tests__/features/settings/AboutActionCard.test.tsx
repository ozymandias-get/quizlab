import AboutActionCard from '@features/settings/ui/about/AboutActionCard'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('AboutActionCard', () => {
  // The component has exactly one branch: `href` decides between an anchor and
  // a plain surface. Both halves plus the content slots are pinned here.
  it('renders an anchor when href is given and a surface otherwise', () => {
    const { rerender } = render(
      <AboutActionCard
        title="Title"
        description="Description"
        href="https://example.com"
        leading={<span>Leading</span>}
        trailing={<button type="button">Action</button>}
      />
    )

    expect(screen.getByRole('link', { name: /title/i })).toHaveAttribute(
      'href',
      'https://example.com'
    )
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Leading')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()

    rerender(<AboutActionCard title="Title" description="Description" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
  })
})
