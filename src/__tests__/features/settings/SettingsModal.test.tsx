import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import SettingsModal from '@features/settings/ui/SettingsModal'

vi.mock('@app/providers', () => ({
  useLanguage: () => ({ t: (key: string) => key })
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

  it('renders modal when open', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('settings_title')).toBeInTheDocument()
  })

  it('switches tabs', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />)

    const languageTab = screen.getByText('language').closest('[role="tab"]') as HTMLElement
    await act(async () => {
      languageTab.focus()
      fireEvent.mouseDown(languageTab, { button: 0, ctrlKey: false })
      fireEvent.mouseUp(languageTab)
      fireEvent.click(languageTab)
    })

    await waitFor(() => {
      expect(languageTab).toHaveAttribute('data-state', 'active')
    })
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
