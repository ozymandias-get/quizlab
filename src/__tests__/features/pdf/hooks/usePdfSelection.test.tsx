import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePdfSelection } from '@features/pdf/hooks/usePdfSelection'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'

const mockShowError = vi.fn()
const mockShowSuccess = vi.fn()
vi.mock('@app/providers/ToastContext', () => ({
  useToastActions: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess
  })
}))

const mockT = vi.fn((key) => key)
vi.mock('@app/providers/LanguageContext', () => ({
  useLanguage: () => ({
    t: mockT
  }),
  useLanguageStrings: () => ({
    t: mockT,
    language: 'en'
  })
}))

const mockSelectPdfMutate = vi.fn()
const mockRegisterPdfPathMutate = vi.fn()

vi.mock('@platform/electron/api/usePdfApi', () => ({
  useSelectPdf: () => ({
    mutateAsync: mockSelectPdfMutate
  }),
  useRegisterPdfPath: () => ({
    mutateAsync: mockRegisterPdfPathMutate
  })
}))

const localStorageMock = (function () {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('usePdfSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it('should select PDF successfully', async () => {
    const mockPdfFile = { name: 'test.pdf', path: '/path/to/test.pdf' }
    mockSelectPdfMutate.mockResolvedValue(mockPdfFile)

    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.handleSelectPdf()
    })

    await waitFor(() => {
      expect(result.current.pdfFile).toEqual(mockPdfFile)
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.LAST_PDF_READING,
      expect.stringContaining('test.pdf')
    )
  })

  it('should handle PDF selection failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockSelectPdfMutate.mockRejectedValue(new Error('Selection cancelled'))
    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.handleSelectPdf()
    })

    expect(result.current.pdfFile).toBeNull()
    errorSpy.mockRestore()
  })

  it('should handle PDF drop successfully', async () => {
    const mockFile = { name: 'dropped.pdf', type: 'application/pdf', path: '/dropped/path.pdf' }
    const mockResult = { name: 'dropped.pdf', path: '/dropped/path.pdf' }
    mockRegisterPdfPathMutate.mockResolvedValue(mockResult)

    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.handlePdfDrop(mockFile as any)
    })

    expect(mockRegisterPdfPathMutate).toHaveBeenCalledWith('/dropped/path.pdf')
    await waitFor(() => {
      expect(result.current.pdfFile).toEqual(mockResult)
    })
    expect(mockShowSuccess).toHaveBeenCalled()
  })

  it('should reject invalid file types on drop', async () => {
    const mockFile = { name: 'image.png', type: 'image/png', path: '/image.png' }
    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.handlePdfDrop(mockFile as any)
    })

    expect(mockShowError).toHaveBeenCalledWith('error_invalid_pdf')
    expect(mockRegisterPdfPathMutate).not.toHaveBeenCalled()
  })

  it('should resume last PDF from localStorage', async () => {
    const storedData = JSON.stringify([
      { name: 'resumed.pdf', path: '/resume/path.pdf', page: 5, totalPages: 10 }
    ])
    localStorageMock.setItem(STORAGE_KEYS.LAST_PDF_READING, storedData)

    const mockResult = { name: 'resumed.pdf', path: '/resume/path.pdf' }
    mockRegisterPdfPathMutate.mockResolvedValue(mockResult)

    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.resumeLastPdf()
    })

    await waitFor(() => {
      expect(mockRegisterPdfPathMutate).toHaveBeenCalledWith('/resume/path.pdf')
      expect(result.current.pdfFile).toEqual(mockResult)
    })
  })

  it('should handle resume failure (invalid path)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const storedData = JSON.stringify([
      { name: 'fail.pdf', path: '/fail/path.pdf', page: 1, totalPages: 0 }
    ])
    localStorageMock.setItem(STORAGE_KEYS.LAST_PDF_READING, storedData)

    mockRegisterPdfPathMutate.mockRejectedValue(new Error('File not found'))

    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.resumeLastPdf()
    })

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('error_pdf_load')
    })

    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(STORAGE_KEYS.LAST_PDF_READING)
    errorSpy.mockRestore()
  })

  it('should retrieve last reading info', async () => {
    const data = { name: 'info.pdf', path: '/info.pdf', page: 10, totalPages: 20 }
    localStorageMock.setItem(STORAGE_KEYS.LAST_PDF_READING, JSON.stringify(data))

    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    const info = result.current.getLastReadingInfo()
    expect(info).toEqual(data)
  })

  it('should keep and order recent reading entries', async () => {
    const files = [
      { name: 'one.pdf', path: '/pdf/one.pdf', streamUrl: 'one-url' },
      { name: 'two.pdf', path: '/pdf/two.pdf', streamUrl: 'two-url' },
      { name: 'three.pdf', path: '/pdf/three.pdf', streamUrl: 'three-url' },
      { name: 'four.pdf', path: '/pdf/four.pdf', streamUrl: 'four-url' }
    ]

    mockSelectPdfMutate
      .mockResolvedValueOnce(files[0])
      .mockResolvedValueOnce(files[1])
      .mockResolvedValueOnce(files[2])
      .mockResolvedValueOnce(files[3])

    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.handleSelectPdf()
      await result.current.handleSelectPdf()
      await result.current.handleSelectPdf()
      await result.current.handleSelectPdf()
    })

    const recent = result.current.getRecentReadingInfo()
    expect(recent).toHaveLength(4)
    expect(recent.map((item) => item.path)).toEqual([
      '/pdf/four.pdf',
      '/pdf/three.pdf',
      '/pdf/two.pdf',
      '/pdf/one.pdf'
    ])
  })

  it('should manage multiple pdf tabs (open, switch, rename, close)', async () => {
    const firstPdf = { name: 'first.pdf', path: '/path/first.pdf', streamUrl: 'first-url' }
    const secondPdf = { name: 'second.pdf', path: '/path/second.pdf', streamUrl: 'second-url' }
    mockSelectPdfMutate.mockResolvedValueOnce(firstPdf).mockResolvedValueOnce(secondPdf)

    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.handleSelectPdf()
    })

    await act(async () => {
      await result.current.handleSelectPdf()
    })

    expect(result.current.pdfTabs).toHaveLength(2)
    expect(result.current.pdfFile?.name).toBe('second.pdf')

    const firstTabId = result.current.pdfTabs[0].id
    const secondTabId = result.current.pdfTabs[1].id

    act(() => {
      result.current.setActivePdfTab(firstTabId)
    })
    expect(result.current.activePdfTabId).toBe(firstTabId)
    expect(result.current.pdfFile?.name).toBe('first.pdf')

    act(() => {
      result.current.renamePdfTab(firstTabId, '  Notes PDF  ')
    })
    expect(result.current.pdfTabs[0].title).toBe('Notes PDF')

    act(() => {
      result.current.closePdfTab(firstTabId)
    })
    expect(result.current.pdfTabs).toHaveLength(1)
    expect(result.current.activePdfTabId).toBe(secondTabId)
  })

  it('should keep the latest reading page in state for tab restore and resume', async () => {
    const firstPdf = { name: 'first.pdf', path: '/path/first.pdf', streamUrl: 'first-url' }
    const secondPdf = { name: 'second.pdf', path: '/path/second.pdf', streamUrl: 'second-url' }
    mockSelectPdfMutate.mockResolvedValueOnce(firstPdf).mockResolvedValueOnce(secondPdf)

    const { result } = renderHook(() => usePdfSelection(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.handleSelectPdf()
    })

    await act(async () => {
      await result.current.handleSelectPdf()
    })

    const firstTabId = result.current.pdfTabs[0].id
    const secondTabId = result.current.pdfTabs[1].id

    act(() => {
      result.current.setActivePdfTab(firstTabId)
    })

    act(() => {
      result.current.updateReadingProgress({
        path: firstPdf.path,
        page: 7,
        totalPages: 30,
        lastOpenedAt: 123456
      })
    })

    expect(result.current.getRecentReadingInfo()[0]).toMatchObject({
      path: firstPdf.path,
      page: 7,
      totalPages: 30,
      lastOpenedAt: 123456
    })
    expect(result.current.activeTabInitialPage).toBe(7)

    act(() => {
      result.current.setActivePdfTab(secondTabId)
    })
    act(() => {
      result.current.setActivePdfTab(firstTabId)
    })

    expect(result.current.activeTabInitialPage).toBe(7)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.LAST_PDF_READING,
      expect.stringContaining('"page":7')
    )
  })
})
