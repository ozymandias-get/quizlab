import React, { act } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSelectPdf, useRegisterPdfPath } from '@platform/electron/api/usePdfApi'
import { getElectronApi } from '@shared/lib/electronApi'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(),
  hasElectronApi: vi.fn().mockReturnValue(true)
}))

vi.mock('@app/providers/ToastContext', () => ({
  useToastActions: () => ({
    showError: vi.fn()
  })
}))

describe('usePdfApi Hooks', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockElectronApi: any

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
      selectPdf: vi
        .fn()
        .mockResolvedValue({ id: 'pdf-1', name: 'document.pdf', path: '/path/doc.pdf' }),
      registerPdfPath: vi
        .fn()
        .mockResolvedValue({ id: 'pdf-2', name: 'dropped.pdf', path: '/path/drop.pdf' })
    }
    vi.mocked(getElectronApi).mockReturnValue(mockElectronApi)
  })

  it('useSelectPdf should invoke selectPdf on Electron API', async () => {
    const { result } = renderHook(() => useSelectPdf(), { wrapper })

    let selectionRes: any
    await act(async () => {
      selectionRes = await result.current.mutateAsync({ initialPath: '/some/dir' })
    })

    expect(mockElectronApi.selectPdf).toHaveBeenCalledWith({ initialPath: '/some/dir' })
    expect(selectionRes).toEqual({ id: 'pdf-1', name: 'document.pdf', path: '/path/doc.pdf' })
  })

  it('useRegisterPdfPath should invoke registerPdfPath on Electron API', async () => {
    const { result } = renderHook(() => useRegisterPdfPath(), { wrapper })

    let registrationRes: any
    await act(async () => {
      registrationRes = await result.current.mutateAsync('/path/dropped.pdf')
    })

    expect(mockElectronApi.registerPdfPath).toHaveBeenCalledWith('/path/dropped.pdf')
    expect(registrationRes).toEqual({ id: 'pdf-2', name: 'dropped.pdf', path: '/path/drop.pdf' })
  })
})
