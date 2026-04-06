import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MagicSelectorTutorial from '@features/tutorial/ui/MagicSelectorTutorial'

vi.mock('@app/providers', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
  useLanguageStrings: () => ({ t: (key: string) => key, language: 'en' })
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    svg: ({ children, ...props }: any) => <svg {...props}>{children}</svg>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('MagicSelectorTutorial Component', () => {
  it('renders intro step initially', () => {
    render(<MagicSelectorTutorial onClose={vi.fn()} />)
    expect(screen.getByText('tut_welcome_title')).toBeInTheDocument()
    expect(screen.getByText('tut_start')).toBeInTheDocument()
  })

  it('navigates through steps', async () => {
    const onComplete = vi.fn()
    render(<MagicSelectorTutorial onClose={vi.fn()} onComplete={onComplete} />)

    fireEvent.click(screen.getByText('tut_start'))
    expect(screen.getByText('tut_select_input_title')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('tut_placeholder')
    fireEvent.click(input)
    expect(screen.getByText('tut_type_msg_title')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'Hello AI' } })
    expect(screen.getByText('tut_select_btn_title')).toBeInTheDocument()

    const allButtons = screen.getAllByRole('button')
    fireEvent.click(allButtons[allButtons.length - 1])

    expect(screen.getByText('tut_success_title')).toBeInTheDocument()

    fireEvent.click(screen.getByText('tut_finish'))
    expect(onComplete).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<MagicSelectorTutorial onClose={onClose} />)

    const closeBtn = screen.getByTitle('tut_close')
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalled()
  })
})
