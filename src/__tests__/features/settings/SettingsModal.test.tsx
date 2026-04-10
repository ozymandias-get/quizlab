import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

    const languageButton = screen.getByRole('tab', { name: 'language' })
    fireEvent.click(languageButton)

    // Wait for the tab button to be selected AND the content to be loaded
    await waitFor(() => {
      const updatedButton = screen.getByRole('tab', { name: 'language' })
      expect(updatedButton).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Language Tab Content')).toBeInTheDocument()
    })
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
