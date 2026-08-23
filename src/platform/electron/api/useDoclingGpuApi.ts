import { useQueryClient } from '@tanstack/react-query'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export const DOCLING_GPU_PREFS_KEY = ['docling', 'gpu', 'prefs'] as const
export const DOCLING_GPU_DETECT_KEY = ['docling', 'gpu', 'detect'] as const

export function useDoclingGpuPrefs() {
  return useElectronQuery<{ enabled: boolean; lastDetected?: string }>({
    key: DOCLING_GPU_PREFS_KEY,
    queryFn: (api) => api.doclingGpu.getPrefs(),
    options: { staleTime: 0, retry: false }
  })
}

export function useDoclingGpuDetect(enabled = true) {
  return useElectronQuery<{ device: string; available: boolean; detail?: string }>({
    key: DOCLING_GPU_DETECT_KEY,
    queryFn: (api) => api.doclingGpu.detect(),
    options: { enabled, staleTime: 5 * 60 * 1000, retry: false }
  })
}

export function useDoclingGpuSetEnabled() {
  const qc = useQueryClient()
  return useElectronMutation<{ enabled: boolean; lastDetected?: string }, boolean>(
    (api, enabled) => api.doclingGpu.setEnabled(enabled),
    {
      errorMessage: 'GPU ayarı kaydedilemedi',
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: DOCLING_GPU_PREFS_KEY })
        void qc.invalidateQueries({ queryKey: DOCLING_GPU_DETECT_KEY })
      }
    }
  )
}

export function useDoclingGpuInstallCuda() {
  const qc = useQueryClient()
  return useElectronMutation<{ success: boolean; detail?: string }, void>(
    (api) => api.doclingGpu.installCuda(),
    {
      errorMessage: 'CUDA paketleri yüklenemedi',
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: DOCLING_GPU_DETECT_KEY })
        void qc.invalidateQueries({ queryKey: DOCLING_GPU_PREFS_KEY })
      }
    }
  )
}
