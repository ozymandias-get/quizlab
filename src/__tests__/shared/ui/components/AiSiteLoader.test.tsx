import AiSiteLoader from '@ui/components/AiSiteLoader'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ui/components/Icons', () => ({
  getAiIcon: (key: string) => (key === 'chatgpt' ? <svg data-testid="brand-icon" /> : null)
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('AiSiteLoader', () => {
  it('shows the brand mark of the site that is about to open', () => {
    render(<AiSiteLoader modelId="gpt-4" iconKey="chatgpt" />)

    expect(screen.getByTestId('brand-icon')).toBeInTheDocument()
    expect(screen.getByTestId('ai-site-loader')).toBeInTheDocument()
  })

  it('falls back to the model initial when the registry has no icon', () => {
    render(<AiSiteLoader modelId="custom-site" />)

    expect(screen.getByTestId('ai-site-loader')).toHaveTextContent('C')
  })
})
