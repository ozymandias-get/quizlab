import { useQueryClient } from '@tanstack/react-query'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export interface DoclingPipelinePrefs {
  doOcr: boolean
  extractFigures: boolean
  detectTables: boolean
  fastTables: boolean
  updatedAt?: number
}

export const DOCLING_PIPELINE_PREFS_KEY = ['docling', 'pipeline', 'prefs'] as const

export function useDoclingPipelinePrefs() {
  return useElectronQuery<DoclingPipelinePrefs>({
    key: DOCLING_PIPELINE_PREFS_KEY,
    queryFn: (api) => api.doclingPipeline.getPrefs(),
    options: { staleTime: 0, retry: false }
  })
}

export function useDoclingPipelineSetPrefs() {
  const qc = useQueryClient()
  return useElectronMutation<DoclingPipelinePrefs, Partial<DoclingPipelinePrefs>>(
    (api, patch) => api.doclingPipeline.setPrefs(patch as Record<string, boolean>),
    {
      errorMessage: 'Pipeline ayarı kaydedilemedi',
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: DOCLING_PIPELINE_PREFS_KEY })
      }
    }
  )
}
