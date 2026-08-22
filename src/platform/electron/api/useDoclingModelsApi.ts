import type { DoclingModelStatusInfo } from '@shared-core/types'

import { useQueryClient } from '@tanstack/react-query'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export const DOCLING_MODELS_KEY = ['docling', 'models'] as const

export function useDoclingModelsStatus() {
  return useElectronQuery<DoclingModelStatusInfo>({
    key: DOCLING_MODELS_KEY,
    queryFn: (api) => api.doclingModels.getStatus(),
    options: { staleTime: 0, retry: false }
  })
}

export function useDoclingModelsDownload() {
  const qc = useQueryClient()
  return useElectronMutation<DoclingModelStatusInfo, void>((api) => api.doclingModels.download(), {
    errorMessage: 'Modeller indirilemedi',
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DOCLING_MODELS_KEY })
      void qc.invalidateQueries({ queryKey: ['docling', 'service', 'status'] })
    }
  })
}

export function useDoclingModelsDelete() {
  const qc = useQueryClient()
  return useElectronMutation<DoclingModelStatusInfo, void>((api) => api.doclingModels.delete(), {
    errorMessage: 'Modeller silinemedi',
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DOCLING_MODELS_KEY })
      void qc.invalidateQueries({ queryKey: ['docling', 'service', 'status'] })
    }
  })
}

export function useDoclingModelsRepair() {
  const qc = useQueryClient()
  return useElectronMutation<DoclingModelStatusInfo, void>((api) => api.doclingModels.repair(), {
    errorMessage: 'Modeller onarılamadı',
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DOCLING_MODELS_KEY })
      void qc.invalidateQueries({ queryKey: ['docling', 'service', 'status'] })
    }
  })
}
