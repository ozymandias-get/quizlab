import { useShellOpenPdf } from '@features/pdf/hooks/useShellOpenPdf'
import { resetReadingProgressStore } from '@features/pdf/hooks/useReadingProgressPersistence'
import { resetPdfTabStore, usePdfTabStore } from '@features/pdf/store/usePdfTabStore'

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockShowError = vi.fn()
const mockShowSuccess = vi.fn()
vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'tr' } })
}))

type ShellCallback = (filePath: string) => void
let capturedCallback: ShellCallback | null = null
const mockRegisterPdfPath = vi.fn()

function installElectronApi() {
  ;(window as any).electronAPI = {
    onShellOpenPdf: vi.fn((cb: ShellCallback) => {
      capturedCallback = cb
      return () => {
        capturedCallback = null
      }
    }),
    registerPdfPath: mockRegisterPdfPath
  }
}

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

describe('useShellOpenPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    capturedCallback = null
    resetPdfTabStore()
    resetReadingProgressStore()
    installElectronApi()
  })

  it('opens the shell pdf in a new tab and toasts', async () => {
    mockRegisterPdfPath.mockResolvedValue({
      path: 'C:\\Docs\\a.pdf',
      name: 'a.pdf',
      size: 10,
      streamUrl: 'local-pdf://x'
    })

    renderHook(() => useShellOpenPdf())

    expect(capturedCallback).not.toBeNull()
    await act(async () => {
      capturedCallback?.('C:\\Docs\\a.pdf')
    })

    await waitFor(() => {
      expect(usePdfTabStore.getState().pdfTabs).toHaveLength(1)
    })
    expect(usePdfTabStore.getState().pdfTabs[0].file?.name).toBe('a.pdf')
    expect(mockShowSuccess).toHaveBeenCalledWith(
      'toast_opened',
      undefined,
      expect.objectContaining({ fileName: 'a.pdf' })
    )
  })

  it('shows an error toast when registration returns null', async () => {
    mockRegisterPdfPath.mockResolvedValue(null)

    renderHook(() => useShellOpenPdf())

    await act(async () => {
      capturedCallback?.('C:\\Docs\\missing.pdf')
    })

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalled()
    })
    expect(usePdfTabStore.getState().pdfTabs).toHaveLength(0)
  })

  it('ignores duplicate events for the same path while opening', async () => {
    let resolveRegister!: (v: unknown) => void
    mockRegisterPdfPath.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve
        })
    )

    renderHook(() => useShellOpenPdf())

    await act(async () => {
      capturedCallback?.('C:\\Docs\\dup.pdf')
      capturedCallback?.('C:\\Docs\\dup.pdf')
    })

    expect(mockRegisterPdfPath).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveRegister({ path: 'C:\\Docs\\dup.pdf', name: 'dup.pdf', streamUrl: 'local-pdf://y' })
    })

    await waitFor(() => {
      expect(usePdfTabStore.getState().pdfTabs).toHaveLength(1)
    })
  })
})
