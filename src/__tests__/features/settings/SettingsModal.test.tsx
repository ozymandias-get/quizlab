import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsModal from '@features/settings/ui/SettingsModal'

const tMock = (key: string) => key
vi.mock('@app/providers', () => ({
  useLanguage: () => ({ t: tMock }),
  useLanguageStrings: () => ({ t: tMock, language: 'en' })
}))

vi.mock('@features/settings/hooks/useSettings', () => ({
  useSettings: () => ({
    appVersion: '1.0.0',
    updateStatus: 'idle',
    updateInfo: null,
    checkForUpdates: vi.fn(),
    openReleasesPage: vi.fn()
  })
}))

vi.mock('framer-motion', () => {
  const createMotionComponent =
    (Component: keyof HTMLElementTagNameMap) =>
    ({ children, initial, animate, exit, transition, layoutId, ...props }: any) => {
      void initial
      void animate
      void exit
      void transition
      void layoutId

      const Tag = Component as any
      return <Tag {...props}>{children}</Tag>
    }

  return {
    motion: {
      div: createMotionComponent('div'),
      h3: createMotionComponent('h3'),
      p: createMotionComponent('p'),
      span: createMotionComponent('span')
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
  }
})

vi.mock('@features/settings/ui/LanguageTab', () => ({
  default: () => <div>Language Tab Content</div>
}))
vi.mock('@features/settings/ui/AboutTab', () => ({ default: () => <div>About Tab Content</div> }))
vi.mock('@features/settings/ui/ModelsTab', () => ({ default: () => <div>Models Tab Content</div> }))
vi.mock('@features/settings/ui/AppearanceTab', () => ({
  default: () => <div>Appearance Tab Content</div>
}))
vi.mock('@features/settings/ui/SelectorsTab', () => ({
  default: () => <div>Selectors Tab Content</div>
}))
vi.mock('@features/settings/ui/PromptsTab', () => ({
  default: () => <div>Prompts Tab Content</div>
}))

describe('SettingsModal Component', () => {
  it('renders nothing when closed', () => {
    render(<SettingsModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('settings_title')).not.toBeInTheDocument()
  })

  it('renders modal when open', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('settings_title')).toBeInTheDocument()
    expect(screen.getByText('settings_title').closest('.glass-tier-1')).not.toBeNull()
    expect(await screen.findByText('Prompts Tab Content')).toBeInTheDocument()
  })

  it('switches tabs', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

    const languageButton = screen.getByRole('tab', { name: 'language' })
    fireEvent.click(languageButton)

    expect(screen.getByRole('tab', { name: 'language' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Language Tab Content')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
