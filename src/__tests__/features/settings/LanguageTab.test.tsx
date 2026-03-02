import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import LanguageTab from '@features/settings/ui/LanguageTab'

// Mock dependencies
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

// Mock Icons
vi.mock('@ui/components/Icons', () => ({
    LanguageIcon: () => <div data-testid="icon-language" />
}))

// Mock animated components
vi.mock('framer-motion', async () => {
    const ActualReact = await vi.importActual('react') as typeof import('react')
    return {
        motion: {
            div: ActualReact.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(({ children, className, ...props }, ref) => (
                <div ref={ref} className={className} {...props}>
                    {children}</div>
            ))
        }
    }
})

describe('LanguageTab', () => {
    it('renders language options', () => {
        render(<LanguageTab />)

        expect(screen.getByText('select_language')).toBeInTheDocument()
        // Use accessible role queries
        expect(screen.getByRole('radio', { name: /English/i })).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /Türkçe/i })).toBeInTheDocument()
    })

    it('displays current language', () => {
        render(<LanguageTab />)
        expect(screen.getByText(/current_language/)).toBeInTheDocument()
    })

    it('allows changing language', () => {
        render(<LanguageTab />)

        // Use radio role which includes the label via children content or aria-label
        const radio = screen.getByRole('radio', { name: /Türkçe/i })
        fireEvent.click(radio)

        expect(setLanguageMock).toHaveBeenCalledWith('tr')
    })
})


