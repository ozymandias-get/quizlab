import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useElectronQuery, useElectronMutation } from '@platform/electron/useElectron'
import { getElectronApi } from '@shared/lib/electronApi'

const showErrorMock = vi.fn()

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(),
  hasElectronApi: vi.fn().mockReturnValue(true)
}))

vi.mock('@app/providers/ToastContext', () => ({
  useToastActions: () => ({
    showError: showErrorMock
  })
}))

describe('useElectron Hooks', () => {
  let queryClient: QueryClient
  let wrapper: React.FC<{ children: React.ReactNode }>
  let mockElectronApi: any

  beforeEach(() => {
    vi.restoreAllMocks()
    showErrorMock.mockReset()

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
      testQuery: vi.fn().mockResolvedValue('query-data'),
      testMutation: vi.fn().mockResolvedValue('mutation-success')
    }
    vi.mocked(getElectronApi).mockReturnValue(mockElectronApi)
  })

  describe('useElectronQuery', () => {
    it('should successfully fetch query data from Electron API', async () => {
      const { result } = renderHook(
        () =>
          useElectronQuery({
            key: ['test-query-key'],
            queryFn: (api) => api.testQuery()
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockElectronApi.testQuery).toHaveBeenCalled()
      expect(result.current.data).toBe('query-data')
    })
  })

  describe('useElectronMutation', () => {
    it('should successfully execute mutation using Electron API', async () => {
      const { result } = renderHook(
        () =>
          useElectronMutation<string, { val: string }>((api, vars) => api.testMutation(vars), {
            errorMessage: 'Failed'
          }),
        { wrapper }
      )

      const mutateRes = await result.current.mutateAsync({ val: 'input-val' })
      expect(mockElectronApi.testMutation).toHaveBeenCalledWith({ val: 'input-val' })
      expect(mutateRes).toBe('mutation-success')
    })

    it('should invoke custom onError and show error toast on mutation failure', async () => {
      const customOnError = vi.fn()
      mockElectronApi.testMutation.mockRejectedValue(new Error('IPC Connection Error'))

      const { result } = renderHook(
        () =>
          useElectronMutation<string, void>((api) => api.testMutation(), {
            errorMessage: 'Custom Mutation Failed',
            onError: customOnError
          }),
        { wrapper }
      )

      try {
        await result.current.mutateAsync()
      } catch (err) {
        // Expected rejection
      }

      expect(customOnError).toHaveBeenCalled()
      expect(showErrorMock).toHaveBeenCalledWith(
        'Custom Mutation Failed',
        'Mutation Error',
        undefined,
        undefined
      )
    })
  })
})
