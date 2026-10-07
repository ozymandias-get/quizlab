import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { languageState } = vi.hoisted(() => ({
  languageState: {
    language: 'en',
    isOnboardingDone: false,
    languages: {
      en: { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' as const },
      tr: { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr' as const }
    },
    setLanguage: vi.fn(),
    completeOnboarding: vi.fn()
  }
}))

vi.mock('@shared/stores/languageStore', () => ({
  useLanguage: Object.assign(
    (selector?: (s: typeof languageState) => unknown) =>
      selector ? selector(languageState) : languageState,
    { getState: () => languageState }
  )
}))

vi.mock('@shared/stores/appearanceStore', () => ({
  useAppearance: () => ({ bgMode: 'light', bottomBarOpacity: 1, bottomBarScale: 1 })
}))

vi.mock('@app/ui/FocusOverlay', () => ({ default: () => null }))
vi.mock('@app/providers/ai-context', () => ({
  useAiTabsSliceState: () => ({ tabs: [], activeTabId: null, currentAI: null }),
  useAiViewRequestNonce: () => 0
}))
vi.mock('@features/screenshot/tool', () => ({ ScreenshotTool: () => null }))
vi.mock('@features/tutorial', () => ({
  TutorialOverlay: () => null,
  useTutorialStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ activeTutorialId: null, closeTutorial: vi.fn() }),
  getTutorialEntry: () => null
}))
vi.mock('@ui/components/UpdateBanner', () => ({ default: () => null }))
vi.mock('@app/ui/AiSendComposer', () => ({ default: () => null }))
vi.mock('@app/hooks/useCacheThresholdWarning', () => ({
  useCacheThresholdWarning: () => {}
}))
vi.mock('@app/hooks/useAppShellState', () => ({
  useAppShellState: () => ({
    updateAvailable: false,
    updateInfo: null,
    isLayoutSwapped: false,
    animations: {},
    isAiSurfaceMounted: false,
    panelResize: {
      leftPanelWidth: 50,
      leftPanelRef: { current: null },
      resizerRef: { current: null },
      handlePointerDown: vi.fn(),
      handlePointerMove: vi.fn(),
      handlePointerUp: vi.fn(),
      handleLostPointerCapture: vi.fn(),
      nudgeLeftPanelWidth: vi.fn(),
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
  useAppToolPickerState: () => ({ isPickerActive: false }),
  useAppToolQueueState: () => ({}),
  useAppToolScreenshotState: () => ({})
}))
vi.mock('@features/tutorial/store/tutorialStore', () => ({ useTutorialStore: () => ({}) }))
vi.mock('@features/tutorial/tutorialRegistry', () => ({ getTutorialEntry: () => null }))
vi.mock('@ui/components/Toast/ToastContainer', () => ({ default: () => null }))
vi.mock('@ui/layout/AppBackground', () => ({ default: () => null }))
vi.mock('@ui/layout/BottomBar', () => ({ default: () => null }))

// Imported after the mocks, as `vi.mock` is hoisted above every import anyway.
import App from '@app/App'

describe('App onboarding gate', () => {
  beforeEach(() => {
    languageState.isOnboardingDone = false
  })

  it('blocks the app behind the language dialog until onboarding is done', async () => {
    render(<App />)
    expect(await screen.findByText('Select Your Language')).toBeInTheDocument()
  })

  it('goes straight to the workspace once onboarding is done', () => {
    languageState.isOnboardingDone = true
    render(<App />)
    expect(screen.queryByText('Select Your Language')).not.toBeInTheDocument()
  })
})
