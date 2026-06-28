import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '@app/App'

const { mockSetLanguage, mockCompleteOnboarding } = vi.hoisted(() => ({
  mockSetLanguage: vi.fn().mockResolvedValue(undefined),
  mockCompleteOnboarding: vi.fn()
}))

vi.mock('@shared/stores/languageStore', () => {
  const state = {
    language: 'en',
    isOnboardingDone: false,
    languages: {
      en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' as const },
      tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', dir: 'ltr' as const }
    },
    setLanguage: mockSetLanguage,
    completeOnboarding: mockCompleteOnboarding
  }
  return {
    useLanguage: Object.assign(
      (selector?: (s: typeof state) => any) => (selector ? selector(state) : state),
      { getState: () => state }
    )
  }
})

vi.mock('@shared/stores/appearanceStore', () => ({
  useAppearance: () => ({ bgMode: 'light', bottomBarOpacity: 1, bottomBarScale: 1 })
}))

vi.mock('@app/ui/FocusOverlay', () => ({ default: () => null }))
vi.mock('@features/screenshot', () => ({ ScreenshotTool: () => null }))
vi.mock('@features/tutorial', () => ({ TutorialOverlay: () => null }))
vi.mock('@ui/components/UpdateBanner', () => ({ default: () => null }))
vi.mock('@app/ui/AiSendComposer', () => ({ default: () => null }))
vi.mock('@features/settings/hooks/useCacheThresholdWarning', () => ({
  useCacheThresholdWarning: () => {}
}))
vi.mock('@app/hooks/useAppShellState', () => ({
  useAppShellState: () => ({
    updateAvailable: false,
    updateInfo: null,
    isLayoutSwapped: false,
    animations: {},
    isWebviewMounted: false,
    panelResize: {
      leftPanelWidth: 50,
      leftPanelRef: { current: null },
      resizerRef: { current: null },
      handleMouseDown: vi.fn(),
      isResizing: false,
      setLeftPanelWidth: vi.fn()
    },
    workspaceState: { isBarHovered: false, setIsBarHovered: vi.fn() },
    updateBanner: { isVisible: false, close: vi.fn() },
    focus: { mode: null, close: vi.fn() }
  })
}))
vi.mock('@app/hooks/usePdfWorkspaceState', () => ({ usePdfWorkspaceState: () => ({}) }))
vi.mock('@app/providers', () => ({
  useAppearance: () => ({ bgMode: 'light', bottomBarOpacity: 1, bottomBarScale: 1 }),
  useAppToolActions: () => ({}),
  useAppToolGeminiSessionState: () => ({}),
  useAppToolPickerState: () => ({ isPickerActive: false }),
  useAppToolQueueState: () => ({}),
  useAppToolScreenshotState: () => ({})
}))
vi.mock('@features/tutorial/store/tutorialStore', () => ({ useTutorialStore: () => ({}) }))
vi.mock('@features/tutorial/tutorialRegistry', () => ({ getTutorialEntry: () => null }))
vi.mock('@ui/components/Toast/ToastContainer', () => ({ default: () => null }))
vi.mock('@ui/layout/AppBackground', () => ({ default: () => null }))
vi.mock('@ui/layout/BottomBar', () => ({ default: () => null }))

describe('App onboarding', () => {
  it('renders LanguageSelectionDialog when onboarding not done', async () => {
    render(<App />)
    expect(await screen.findByText('Select Your Language')).toBeInTheDocument()
  })
})
