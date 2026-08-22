import type { DoclingServiceStatus } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'

import type { UseQueryOptions } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export const DOCLING_SERVICE_STATUS_KEY = ['docling', 'service', 'status'] as const

export function useDoclingServiceStatus(
  options?: Omit<
    UseQueryOptions<DoclingServiceStatus, Error, DoclingServiceStatus>,
    'queryKey' | 'queryFn'
  >
) {
  return useElectronQuery<DoclingServiceStatus>({
    key: DOCLING_SERVICE_STATUS_KEY,
    queryFn: (api) => api.doclingService.getStatus(),
    options: {
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
      ...options
    }
  })
}

export function useDoclingServiceEnsureRunning() {
  const queryClient = useQueryClient()
  return useElectronMutation<DoclingServiceStatus, void>(
    (api) => api.doclingService.ensureRunning(),
    {
      errorMessage: 'Docling servisi başlatılamadı',
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: DOCLING_SERVICE_STATUS_KEY })
      }
    }
  )
}

export function useDoclingServiceStop() {
  const queryClient = useQueryClient()
  return useElectronMutation<DoclingServiceStatus, void>((api) => api.doclingService.stop(), {
    errorMessage: 'Docling servisi durdurulamadı',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOCLING_SERVICE_STATUS_KEY })
    }
  })
}

export function useDoclingServiceRestart() {
  const queryClient = useQueryClient()
  return useElectronMutation<DoclingServiceStatus, void>((api) => api.doclingService.restart(), {
    errorMessage: 'Docling servisi yeniden başlatılamadı',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DOCLING_SERVICE_STATUS_KEY })
    }
  })
}

export function useDoclingServiceStatusSubscription(enabled = true): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const api = getElectronApi()
    if (!api?.doclingService?.onStatusChanged) return
    const unsubscribe = api.doclingService.onStatusChanged(() => {
      void queryClient.invalidateQueries({ queryKey: DOCLING_SERVICE_STATUS_KEY })
    })
    return unsubscribe
  }, [enabled, queryClient])
}
