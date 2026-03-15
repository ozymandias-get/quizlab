import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AboutActionCard from '@features/settings/ui/about/AboutActionCard'

describe('AboutActionCard', () => {
  it('renders title, description, leading, and trailing content', () => {
    render(
      <AboutActionCard
        title="Title"
        description="Description"
        leading={<span>Leading</span>}
        trailing={<button type="button">Action</button>}
      />
    )

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Leading')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('renders as a link when href is provided', () => {
    render(<AboutActionCard title="Title" description="Description" href="https://example.com" />)

    expect(screen.getByRole('link', { name: /title/i })).toHaveAttribute(
      'href',
      'https://example.com'
    )
  })
})
