/**
 * Tests for src/app/hooks/usePdfWorkspaceState.ts
 *
 * Composes usePdfSelection into workspace props.
 * We mock all dependencies and verify the returned shape + callbacks.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const mockHandlePdfDrop = vi.fn()
const mockHandleSelectPdf = vi.fn()
const mockSetActivePdfTab = vi.fn()
const mockClosePdfTab = vi.fn()
const mockMovePdfTab = vi.fn()
const mockUpdateReadingProgress = vi.fn()
const mockResumeLastPdf = vi.fn().mockResolvedValue(undefined)
const mockClearLastReading = vi.fn()
const mockRestoreRecentReading = vi.fn()
const mockAddEmptyPdfTab = vi.fn()
const mockGoToPdfHome = vi.fn()
const mockOpenPdfInTab = vi.fn()
const mockUpsertLastReadingInfo = vi.fn()
const recentReadingInfo = [
  { path: '/notes.pdf', name: 'notes.pdf', page: 8, totalPages: 20, lastOpenedAt: 1 }
]

vi.mock('@features/pdf', () => ({
  usePdfSelection: () => ({
    pdfFile: null,
    pdfTabs: [],
    activePdfTab: null,
    activePdfTabId: null,
    setActivePdfTab: mockSetActivePdfTab,
    closePdfTab: mockClosePdfTab,
    movePdfTab: mockMovePdfTab,
    handleSelectPdf: mockHandleSelectPdf,
    handlePdfDrop: mockHandlePdfDrop,
    updateReadingProgress: mockUpdateReadingProgress,
    resumeLastPdf: mockResumeLastPdf,
    recentReadingInfo,
    clearLastReading: mockClearLastReading,
    restoreRecentReading: mockRestoreRecentReading,
    addEmptyPdfTab: mockAddEmptyPdfTab,
    activeTabInitialPage: 1,
    goToPdfHome: mockGoToPdfHome,
    openPdfInTab: mockOpenPdfInTab,
    upsertLastReadingInfo: mockUpsertLastReadingInfo
  })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
}))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(() => null)
}))

const { getElectronApi } = await import('@shared/lib/electronApi')

const { usePdfWorkspaceState } = await import('@app/hooks/usePdfWorkspaceState')

describe('usePdfWorkspaceState', () => {
  const defaultParams = { isInteractionBlocked: false, isPanelResizing: false }

  beforeEach(() => {
    vi.clearAllMocks()
    // `clearAllMocks` is `mockClear`: it drops call history but keeps return
    // values. A test that installs a fake API and then fails would otherwise
    // leave it installed for every later test in the file.
    vi.mocked(getElectronApi).mockReturnValue(null)
  })

  describe('readingProps', () => {
    it('removes only the old history entry when relinking to a different path', async () => {
      vi.mocked(getElectronApi).mockReturnValue({
        selectPdf: vi.fn().mockResolvedValue({ path: '/moved/notes.pdf', name: 'notes.pdf' }),
        getPdfStreamUrl: vi.fn().mockResolvedValue('local-pdf://notes')
      } as never)
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      await act(async () => {
        expect(await result.current.readingProps.onRelinkPdf('/notes.pdf')).toBe(true)
      })
      expect(mockUpsertLastReadingInfo).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/moved/notes.pdf', page: 8 })
      )
      expect(mockClearLastReading).toHaveBeenCalledWith('/notes.pdf')
      vi.mocked(getElectronApi).mockReturnValue(null)
    })
    it('preserves history when relinking to the same path', async () => {
      vi.mocked(getElectronApi).mockReturnValue({
        selectPdf: vi.fn().mockResolvedValue({ path: '/notes.pdf', name: 'notes.pdf' }),
        getPdfStreamUrl: vi.fn().mockResolvedValue('local-pdf://notes')
      } as never)
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      await act(async () => {
        expect(await result.current.readingProps.onRelinkPdf('/notes.pdf')).toBe(true)
      })
      expect(mockUpsertLastReadingInfo).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/notes.pdf', page: 8 })
      )
      expect(mockClearLastReading).not.toHaveBeenCalled()
      vi.mocked(getElectronApi).mockReturnValue(null)
    })
  })

  describe('composed callbacks', () => {
    it('wires the reading and drag callbacks to their sources', () => {
      const { result } = renderHook(() => usePdfWorkspaceState(defaultParams))
      const dragOver = { preventDefault: vi.fn() }

      act(() => {
        result.current.leftPanelProps.onSetActivePdfTab('tab-1')
        result.current.readingProps.onClearResumePdf()
        result.current.rootDragHandlers.onDragOver(dragOver as any)
      })

      const file = new File([''], 'test.pdf', { type: 'application/pdf' })
      act(() => {
        result.current.rootDragHandlers.onDrop({
          preventDefault: vi.fn(),
          dataTransfer: { files: [file] }
        } as any)
      })

      expect(mockSetActivePdfTab).toHaveBeenCalledWith('tab-1')
      expect(mockClearLastReading).toHaveBeenCalled()
      expect(dragOver.preventDefault).toHaveBeenCalled()
      expect(mockHandlePdfDrop).toHaveBeenCalledWith(file)
    })
  })
})
