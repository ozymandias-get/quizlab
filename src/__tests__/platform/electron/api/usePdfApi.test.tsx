import type { PdfSelection } from '@shared-core/types'
import type { ElectronApi } from '@shared-core/types/ipcContract'

import { useRegisterPdfPath, useSelectPdf } from '@platform/electron/api/usePdfApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import React, { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(),
  hasElectronApi: vi.fn().mockReturnValue(true)
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showError: vi.fn()
  })
}))

describe('usePdfApi', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockElectronApi: Partial<ElectronApi>

  const selectPdfResult: PdfSelection = {
    name: 'document.pdf',
    path: '/path/doc.pdf',
    size: 1024,
    streamUrl: 'local-pdf://pdf_test1'
  }
  const registerPdfResult: PdfSelection = {
    name: 'dropped.pdf',
    path: '/path/drop.pdf',
    size: 2048,
    streamUrl: 'local-pdf://pdf_test2'
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    mockElectronApi = {
      selectPdf: vi.fn().mockResolvedValue(selectPdfResult),
      registerPdfPath: vi.fn().mockResolvedValue(registerPdfResult)
    }
    vi.mocked(getElectronApi).mockReturnValue(mockElectronApi as ElectronApi)
  })

  it('useSelectPdf should invoke selectPdf on Electron API', async () => {
    const { result } = renderHook(() => useSelectPdf(), { wrapper })

    const selectionRes = await act(async () => {
      return await result.current.mutateAsync({ filterName: '/some/dir' })
    })

    expect(mockElectronApi.selectPdf).toHaveBeenCalledWith({ filterName: '/some/dir' })
    expect(selectionRes).toEqual(selectPdfResult)
  })

  it('useRegisterPdfPath should invoke registerPdfPath on Electron API', async () => {
    const { result } = renderHook(() => useRegisterPdfPath(), { wrapper })

    const registrationRes = await act(async () => {
      return await result.current.mutateAsync('/path/dropped.pdf')
    })

    expect(mockElectronApi.registerPdfPath).toHaveBeenCalledWith('/path/dropped.pdf')
    expect(registrationRes).toEqual(registerPdfResult)
  })
})
