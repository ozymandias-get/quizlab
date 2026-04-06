import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UsageAssistant from '@features/tutorial/ui/UsageAssistant'

vi.mock('@app/providers', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
  useLanguageStrings: () => ({ t: (key: string) => key, language: 'en' })
}))

describe('UsageAssistant Component', () => {
  it('renders nothing when not active', () => {
    render(<UsageAssistant isActive={false} onClose={vi.fn()} />)
    expect(screen.queryByText('ua_step1_title')).not.toBeInTheDocument()
  })

  it('renders first step when active', () => {
    const mockElement = document.createElement('div')
    Object.defineProperty(mockElement, 'getBoundingClientRect', {
      value: () => ({ top: 100, left: 100, width: 50, height: 50, bottom: 150, right: 150 })
    })
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

    render(<UsageAssistant isActive={true} onClose={vi.fn()} />)

    expect(screen.getByText('ua_step1_title')).toBeInTheDocument()
    expect(screen.getByText('ua_step1_text')).toBeInTheDocument()
  })

  it('navigates to next step', () => {
    const mockElement = document.createElement('div')
    Object.defineProperty(mockElement, 'getBoundingClientRect', {
      value: () => ({ top: 100, left: 100, width: 50, height: 50 })
    })
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

    render(<UsageAssistant isActive={true} onClose={vi.fn()} />)

    const nextBtn = screen.getByText('ua_next')
    fireEvent.click(nextBtn)

    expect(screen.getByText('ua_step2_title')).toBeInTheDocument()
  })

  it('calls onClose when finished or skipped', () => {
    const onClose = vi.fn()
    const mockElement = document.createElement('div')
    Object.defineProperty(mockElement, 'getBoundingClientRect', {
      value: () => ({ top: 100, left: 100, width: 50, height: 50 })
    })
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

    render(<UsageAssistant isActive={true} onClose={onClose} />)

    const skipBtn = screen.getByText('ua_skip')
    fireEvent.click(skipBtn)

    expect(onClose).toHaveBeenCalled()
  })
})
