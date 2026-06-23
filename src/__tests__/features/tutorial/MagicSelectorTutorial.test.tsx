import MagicSelectorTutorial from '@features/tutorial/ui/MagicSelectorTutorial'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        tut_welcome_title: 'Welcome',
        tut_welcome_desc: 'Learn automation',
        tut_select_input_title: 'Select Input',
        tut_select_input_desc: 'Click the input',
        tut_type_msg_title: 'Type Message',
        tut_type_msg_desc: 'Type hello',
        tut_select_btn_title: 'Select Button',
        tut_select_btn_desc: 'Click the button',
        tut_success_title: 'Done',
        tut_success_desc: 'You did it',
        tut_close: 'Close',
        tut_start: 'Start',
        tut_finish: 'Finish',
        tut_disclaimer: 'Disclaimer',
        tut_example_site_desc: 'How can I help?',
        tut_placeholder: 'Ask anything',
        tut_click_input: 'Click Input',
        tut_click_btn: 'Click Button',
        tut_input_label: 'Input',
        tut_btn_label: 'Button'
      }
      return translations[key] ?? key
    },
    i18n: { language: 'en' }
  })
}))

describe('MagicSelectorTutorial', () => {
  it('renders welcome step with heading', () => {
    render(<MagicSelectorTutorial onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText('Learn automation')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<MagicSelectorTutorial onClose={onClose} />)
    fireEvent.click(screen.getByTitle('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders step progress indicators', () => {
    render(<MagicSelectorTutorial onClose={vi.fn()} />)
    expect(screen.getByText('1/5')).toBeInTheDocument()
  })

  it('has step navigation buttons', () => {
    render(<MagicSelectorTutorial onClose={vi.fn()} />)
    expect(screen.getByLabelText('Step 1: Welcome')).toBeInTheDocument()
    expect(screen.getByLabelText('Step 2: Select Input')).toBeInTheDocument()
    expect(screen.getByLabelText('Step 3: Type Message')).toBeInTheDocument()
    expect(screen.getByLabelText('Step 4: Select Button')).toBeInTheDocument()
    expect(screen.getByLabelText('Step 5: Done')).toBeInTheDocument()
  })

  it('renders the simulated chat input', () => {
    render(<MagicSelectorTutorial onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText('Ask anything')).toBeInTheDocument()
  })
})
