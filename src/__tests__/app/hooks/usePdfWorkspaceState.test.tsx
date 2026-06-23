/**
 * Tests for src/app/hooks/usePdfWorkspaceState.ts
 *
 * Composes usePdfSelection + useTextSelection into workspace props.
 * We mock all dependencies and verify the returned shape + callbacks.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks ---
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const mockHandlePdfDrop = vi.fn()
const mockHandleSelectPdf = vi.fn()
const mockSetActivePdfTab = vi.fn()
const mockClosePdfTab = vi.fn()
const mockRenamePdfTab = vi.fn()
const mockUpdateReadingProgress = vi.fn()
const mockResumeLastPdf = vi.fn().mockResolvedValue(undefined)
const mockClearLastReading = vi.fn()
const mockRestoreRecentReading = vi.fn()
const mockAddEmptyPdfTab = vi.fn()
const mockGoToPdfHome = vi.fn()
const mockOpenPdfInTab = vi.fn()
const mockUpsertLastReadingInfo = vi.fn()

vi.mock('@features/pdf', () => ({
  usePdfSelection: () => ({
    pdfFile: null,
    pdfTabs: [],
    activePdfTab: null,
    activePdfTabId: null,
    setActivePdfTab: mockSetActivePdfTab,
    closePdfTab: mockClosePdfTab,
    renamePdfTab: mockRenamePdfTab,
    handleSelectPdf: mockHandleSelectPdf,
    handlePdfDrop: mockHandlePdfDrop,
    updateReadingProgress: mockUpdateReadingProgress,
    resumeLastPdf: mockResumeLastPdf,
    recentReadingInfo: [],
    clearLastReading: mockClearLastReading,
    restoreRecentReading: mockRestoreRecentReading,
    addEmptyPdfTab: mockAddEmptyPdfTab,
    activeTabInitialPage: 1,
    goToPdfHome: mockGoToPdfHome,
    openPdfInTab: mockOpenPdfInTab,
    upsertLastReadingInfo: mockUpsertLastReadingInfo
  })
}))

const mockHandleTextSelection = vi.fn()
vi.mock('@app/hooks/useTextSelection', () => ({
  useTextSelection: () => ({
    handleTextSelection: mockHandleTextSelection
  })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(() => null)
}))

const { usePdfWorkspaceState } = await import('@app/hooks/usePdfWorkspaceState')

describe('usePdfWorkspaceState', () => {
  const defaultParams = { isInteractionBlocked: false, isPanelResizing: false }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the expected shape', () => {
    const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
    expect(result.current).toHaveProperty('t')
    expect(result.current).toHaveProperty('leftPanelProps')
    expect(result.current).toHaveProperty('readingProps')
    expect(result.current).toHaveProperty('rootDragHandlers')
  })

  describe('leftPanelProps', () => {
    it('passes through PDF tab props', () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      expect(result.current.leftPanelProps.pdfTabs).toEqual([])
      expect(result.current.leftPanelProps.pdfFile).toBeNull()
      expect(result.current.leftPanelProps.activePdfTab).toBeNull()
    })

    it('passes through interaction states', () => {
      const { result } = renderHook(() =>
        usePdfWorkspaceState({ isInteractionBlocked: true, isPanelResizing: true })
      )
      expect(result.current.isInteractionBlocked).toBe(true)
      expect(result.current.isPanelResizing).toBe(true)
    })

    it('onSelectPdf calls handleSelectPdf', () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      act(() => {
        result.current.leftPanelProps.onSelectPdf()
      })
      expect(mockHandleSelectPdf).toHaveBeenCalled()
    })

    it('onSetActivePdfTab calls setActivePdfTab', () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      act(() => {
        result.current.leftPanelProps.onSetActivePdfTab('tab-1')
      })
      expect(mockSetActivePdfTab).toHaveBeenCalledWith('tab-1')
    })
  })

  describe('readingProps', () => {
    it('includes reading progress callbacks without lastReadingInfo', () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      expect(result.current.readingProps).toHaveProperty('onReadingProgressChange')
      expect(result.current.readingProps).not.toHaveProperty('lastReadingInfo')
    })

    it('onResumePdf calls resumeLastPdf', async () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      await act(async () => {
        await result.current.readingProps.onResumePdf()
      })
      expect(mockResumeLastPdf).toHaveBeenCalled()
    })

    it('onClearResumePdf calls clearLastReading', () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      act(() => {
        result.current.readingProps.onClearResumePdf()
      })
      expect(mockClearLastReading).toHaveBeenCalled()
    })
  })

  describe('rootDragHandlers', () => {
    it('onDragOver prevents default', () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      const mockEvent = { preventDefault: vi.fn() } as any
      act(() => {
        result.current.rootDragHandlers.onDragOver(mockEvent)
      })
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })

    it('onDrop calls handlePdfDrop with the file', () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      const mockFile = new File([''], 'test.pdf', { type: 'application/pdf' })
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: { files: [mockFile] }
      } as any
      act(() => {
        result.current.rootDragHandlers.onDrop(mockEvent)
      })
      expect(mockHandlePdfDrop).toHaveBeenCalledWith(mockFile)
    })
  })
})
