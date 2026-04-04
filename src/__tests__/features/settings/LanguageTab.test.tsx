import { forwardRef, type ComponentProps } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import LanguageTab from '@features/settings/ui/LanguageTab'

const { setLanguageMock } = vi.hoisted(() => ({
  setLanguageMock: vi.fn()
}))

vi.mock('@app/providers', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
    setLanguage: setLanguageMock,
    languages: {
      en: { code: 'en', name: 'English', nativeName: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
      tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '\u{1F1F9}\u{1F1F7}' }
    }
  })
}))

vi.mock('@ui/components/Icons', () => ({
  LanguageIcon: () => <div data-testid="icon-language" />
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: forwardRef<HTMLDivElement, ComponentProps<'div'>>(
      ({ children, className, ...props }, ref) => (
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      )
    )
  }
}))

describe('LanguageTab', () => {
  it('renders language options', () => {
    render(<LanguageTab />)

    expect(screen.getByText('select_language')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /English/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Türkçe/i })).toBeInTheDocument()
  })

  it('displays current language', () => {
    render(<LanguageTab />)
    expect(screen.getByText(/current_language/)).toBeInTheDocument()
  })

  it('allows changing language', () => {
    render(<LanguageTab />)

    const radio = screen.getByRole('radio', { name: /Türkçe/i })
    fireEvent.click(radio)

    expect(setLanguageMock).toHaveBeenCalledWith('tr')
  })
})
