import type { DoclingPipelinePrefs } from '@shared-core/types'

import { useQueryClient } from '@tanstack/react-query'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export type { DoclingPipelinePrefs }

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
    (api, patch) => api.doclingPipeline.setPrefs(patch),
    {
      errorMessage: 'Pipeline ayarı kaydedilemedi',
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: DOCLING_PIPELINE_PREFS_KEY })
      }
    }
  )
}
