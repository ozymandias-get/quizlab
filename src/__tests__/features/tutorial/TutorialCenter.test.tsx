import { useTutorialStore } from '@features/tutorial/store/tutorialStore'
import TutorialCenter from '@features/tutorial/ui/TutorialCenter'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        tutorial_center_title: 'Usage Guide',
        tutorial_center_desc: 'Browse tutorials',
        tutorial_center_reset: 'Reset All',
        tutorial_replay: 'Replay',
        tutorial_step_next: 'Start',
        tutorial_completed_badge: 'Done',
        tutorial_category_onboarding: 'Getting Started',
        tutorial_category_general: 'General',
        tutorial_category_pdf: 'PDF',
        tutorial_category_ai: 'AI',
        tutorial_category_automation: 'Automation',
        tutorial_category_settings: 'Settings',
        tutorial_general_title: 'General Tour',
        tutorial_general_desc: 'A quick tour',
        tutorial_pdf_title: 'PDF Viewer Guide',
        tutorial_pdf_desc: 'Learn PDF features',
        tutorial_ai_title: 'AI Panel Guide',
        tutorial_ai_desc: 'Learn AI features',
        tutorial_settings_title: 'Settings Guide',
        tutorial_settings_desc: 'Learn settings',
        tutorial_magic_selector_title: 'Magic Selector',
        tutorial_magic_selector_desc: 'Element picker tutorial'
      }
      return translations[key] ?? key
    },
    i18n: { language: 'en' }
  })
}))

describe('TutorialCenter', () => {
  beforeEach(() => {
    useTutorialStore.getState().resetProgress()
  })

  it('renders the title and description', () => {
    render(<TutorialCenter onStartTutorial={vi.fn()} />)
    expect(screen.getByText('Usage Guide')).toBeInTheDocument()
    expect(screen.getByText('Browse tutorials')).toBeInTheDocument()
  })

  it('renders tutorial cards', () => {
    render(<TutorialCenter onStartTutorial={vi.fn()} />)
    expect(screen.getByText('General Tour')).toBeInTheDocument()
    expect(screen.getByText('PDF Viewer Guide')).toBeInTheDocument()
    expect(screen.getByText('AI Panel Guide')).toBeInTheDocument()
  })

  it('calls onStartTutorial when a card start button is clicked', () => {
    const onStart = vi.fn()
    render(<TutorialCenter onStartTutorial={onStart} />)
    const startButtons = screen.getAllByText('Start')
    fireEvent.click(startButtons[0].closest('button')!)
    expect(onStart).toHaveBeenCalled()
  })

  it('shows reset button when there are completed tutorials', () => {
    useTutorialStore.getState().markComplete('general')
    render(<TutorialCenter onStartTutorial={vi.fn()} />)
    expect(screen.getByText('Reset All')).toBeInTheDocument()
  })

  it('hides reset button when no tutorials are completed', () => {
    render(<TutorialCenter onStartTutorial={vi.fn()} />)
    expect(screen.queryByText('Reset All')).not.toBeInTheDocument()
  })
})
