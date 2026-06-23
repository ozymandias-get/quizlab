import { fireEvent, render, screen } from '@testing-library/react'
import { type ComponentProps, forwardRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import LanguageTab from '@features/settings/ui/LanguageTab'

const languageState = vi.hoisted(() => ({
  setLanguage: vi.fn(),
  languages: {
    en: { code: 'en', name: 'English', nativeName: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
    tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '\u{1F1F9}\u{1F1F7}' }
  }
}))

vi.mock('@app/providers', () => ({
  useLanguage: (selector: (state: any) => any) =>
    selector({
      setLanguage: languageState.setLanguage,
      languages: languageState.languages
    })
}))

vi.mock('@ui/components/Icons', () => ({
  LanguageIcon: () => <div data-testid="icon-language" />
}))

vi.mock('motion/react', () => ({
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))
describe('LanguageTab', () => {
  it('renders language options', () => {
    render(<LanguageTab />)

    expect(screen.getByText('select_language')).toBeInTheDocument()
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Türkçe')).toBeInTheDocument()
  })

  it('displays current language', () => {
    render(<LanguageTab />)
    expect(screen.getByText(/current_language/)).toBeInTheDocument()
  })

  it('allows changing language', () => {
    render(<LanguageTab />)

    fireEvent.click(screen.getByText('Türkçe'))

    expect(languageState.setLanguage).toHaveBeenCalledWith('tr')
  })
})
