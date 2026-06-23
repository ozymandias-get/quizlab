import AestheticLoader from '@ui/components/AestheticLoader'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

describe('AestheticLoader', () => {
  it('should render correctly', () => {
    render(<AestheticLoader />)
    expect(screen.getByText('app_name')).toBeInTheDocument()

    const loaderMsg = screen.getByText(/loader_msg_\d+/)
    expect(loaderMsg).toBeInTheDocument()
  })
})
