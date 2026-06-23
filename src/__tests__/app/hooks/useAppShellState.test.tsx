/**
 * Tests for src/app/hooks/useAppShellState.ts
 *
 * Top-level shell state hook composing appearance, tutorial, panel resize,
 * focus mode, animations, and webview mount.  All deps are mocked.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---
const mockSetFocusMode = vi.fn()
const mockToggleFocusMode = vi.fn()
const mockCloseTutorial = vi.fn()

vi.mock('@app/providers', () => ({
  useAppearance: (selector: (s: any) => any) =>
    selector({
      bottomBarScale: 1.0,
      isLayoutSwapped: false,
      focusMode: null,
      setFocusMode: mockSetFocusMode,
      toggleFocusMode: mockToggleFocusMode
    }),
  useUpdate: () => ({
    updateAvailable: false,
    updateInfo: null
  })
}))

vi.mock('@shared/hooks', () => ({
  usePanelResize: () => ({
    leftWidth: 50,
    rightWidth: 50,
    isResizing: false,
    startResizing: vi.fn(),
    stopResizing: vi.fn()
  }),
  useWebviewMount: () => true
}))

vi.mock('@features/tutorial/store/tutorialStore', () => ({
  useTutorialStore: (selector: (s: any) => any) =>
    selector({
      activeTutorialId: null,
      closeTutorial: mockCloseTutorial
    })
}))

vi.mock('@app/hooks/useAppAnimations', () => ({
  useAppAnimations: () => ({
    showLeftPanel: true,
    leftPanelVariant: 'visible',
    showBottomBar: true,
    bottomBarVariant: 'visible'
  })
}))

vi.mock('@app/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true
}))

const { useAppShellState } = await import('@app/hooks/useAppShellState')

describe('useAppShellState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the expected shape', () => {
    const { result } = renderHook(() => useAppShellState())
    expect(result.current).toHaveProperty('updateAvailable')
    expect(result.current).toHaveProperty('updateInfo')
    expect(result.current).toHaveProperty('isLayoutSwapped')
    expect(result.current).toHaveProperty('animations')
    expect(result.current).toHaveProperty('isWebviewMounted')
    expect(result.current).toHaveProperty('panelResize')
    expect(result.current).toHaveProperty('workspaceState')
    expect(result.current).toHaveProperty('updateBanner')
    expect(result.current).toHaveProperty('tour')
    expect(result.current).toHaveProperty('focus')
  })

  it('reports update available false by default', () => {
    const { result } = renderHook(() => useAppShellState())
    expect(result.current.updateAvailable).toBe(false)
    expect(result.current.updateInfo).toBeNull()
  })

  it('reports layout not swapped by default', () => {
    const { result } = renderHook(() => useAppShellState())
    expect(result.current.isLayoutSwapped).toBe(false)
  })

  it('reports webview as mounted', () => {
    const { result } = renderHook(() => useAppShellState())
    expect(result.current.isWebviewMounted).toBe(true)
  })

  describe('workspaceState', () => {
    it('starts with bar not hovered', () => {
      const { result } = renderHook(() => useAppShellState())
      expect(result.current.workspaceState.isBarHovered).toBe(false)
    })

    it('setIsBarHovered updates hover state', () => {
      const { result } = renderHook(() => useAppShellState())
      act(() => {
        result.current.workspaceState.setIsBarHovered(true)
      })
      expect(result.current.workspaceState.isBarHovered).toBe(true)
    })
  })

  describe('updateBanner', () => {
    it('is visible by default', () => {
      const { result } = renderHook(() => useAppShellState())
      expect(result.current.updateBanner.isVisible).toBe(true)
    })

    it('close hides the banner', () => {
      const { result } = renderHook(() => useAppShellState())
      act(() => {
        result.current.updateBanner.close()
      })
      expect(result.current.updateBanner.isVisible).toBe(false)
    })
  })

  describe('tour', () => {
    it('is not active by default', () => {
      const { result } = renderHook(() => useAppShellState())
      expect(result.current.tour.isActive).toBe(false)
    })

    it('close calls closeTutorial', () => {
      const { result } = renderHook(() => useAppShellState())
      act(() => {
        result.current.tour.close()
      })
      expect(mockCloseTutorial).toHaveBeenCalled()
    })
  })

  describe('focus', () => {
    it('mode is null by default', () => {
      const { result } = renderHook(() => useAppShellState())
      expect(result.current.focus.mode).toBeNull()
    })

    it('toggle calls toggleFocusMode', () => {
      const { result } = renderHook(() => useAppShellState())
      act(() => {
        result.current.focus.toggle('pdf')
      })
      expect(mockToggleFocusMode).toHaveBeenCalledWith('pdf')
    })

    it('close calls setFocusMode with null', () => {
      const { result } = renderHook(() => useAppShellState())
      act(() => {
        result.current.focus.close()
      })
      expect(mockSetFocusMode).toHaveBeenCalledWith(null)
    })
  })
})
