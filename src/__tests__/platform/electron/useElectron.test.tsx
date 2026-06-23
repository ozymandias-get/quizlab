import { useElectronMutation, useElectronQuery } from '@platform/electron/useElectron'

import { getElectronApi } from '@shared/lib/electronApi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showErrorMock = vi.fn()

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(),
  hasElectronApi: vi.fn().mockReturnValue(true)
}))

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({
    showError: showErrorMock
  })
}))

describe('useElectron', () => {
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
            queryFn: (api: any) => api.testQuery()
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
          useElectronMutation<string, { val: string }>((api: any, vars) => api.testMutation(vars), {
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
          useElectronMutation<string, void>((api: any) => api.testMutation(), {
            errorMessage: 'Custom Mutation Failed',
            onError: customOnError
          }),
        { wrapper }
      )

      try {
        await result.current.mutateAsync()
      } catch {
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
