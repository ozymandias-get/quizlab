/**
 * Tests for src/shared/ui/components/BrowserFallback.tsx
 */
import BrowserFallback from '@shared/ui/components/BrowserFallback'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        browser_fallback_title: 'QuizLab Desktop Only',
        browser_fallback_description: 'This app requires the desktop version.',
        browser_fallback_download: 'Download',
        browser_fallback_retry: 'Retry'
      }
      return map[key] || key
    }
  })
}))

describe('BrowserFallback', () => {
  it('renders the title', () => {
    render(<BrowserFallback />)
    expect(screen.getByText('QuizLab Desktop Only')).toBeInTheDocument()
  })

  it('renders the description', () => {
    render(<BrowserFallback />)
    expect(screen.getByText('This app requires the desktop version.')).toBeInTheDocument()
  })

  it('renders download and retry buttons', () => {
    render(<BrowserFallback />)
    expect(screen.getByText('Download')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })
})
