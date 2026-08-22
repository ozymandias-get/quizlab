import {
  useDoclingModelsDelete,
  useDoclingModelsDownload,
  useDoclingModelsRepair,
  useDoclingModelsStatus
} from '@platform/electron/api/useDoclingModelsApi'
import {
  useDoclingServiceStatus,
  useDoclingServiceStatusSubscription
} from '@platform/electron/api/useDoclingServiceApi'
import {
  OPTIONAL_COMPONENTS_KEY,
  useOptionalComponentAction,
  useOptionalComponents
} from '@platform/electron/api/useOptionalComponentsApi'

import { getElectronApi } from '@shared/lib/electronApi'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

type InstallProgress = { phase: string; percent: number | null; message?: string } | null

export function useDoclingTabState() {
  const queryClient = useQueryClient()
  const { data: components, isLoading, refetch } = useOptionalComponents()
  const { data: serviceStatus } = useDoclingServiceStatus()
  useDoclingServiceStatusSubscription(true)
  const {
    data: modelStatus,
    isLoading: isModelLoading,
    refetch: refetchModels
  } = useDoclingModelsStatus()
  const downloadModels = useDoclingModelsDownload()
  const deleteModels = useDoclingModelsDelete()
  const repairModels = useDoclingModelsRepair()

  const docling = useMemo(() => components?.find((c) => c.id === 'docling') ?? null, [components])
  const action = useOptionalComponentAction()
  const [progress, setProgress] = useState<InstallProgress>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isBusy = useMemo(() => {
    const s = docling?.status
    return s === 'installing' || s === 'uninstalling' || s === 'updating' || s === 'repairing'
  }, [docling?.status])

  const isInstalled = docling?.status === 'installed'

  useEffect(() => {
    const api = getElectronApi()
    if (!api?.onDoclingInstallProgress) return
    const off = api.onDoclingInstallProgress((event) => {
      if (event.componentId !== 'docling') return
      setProgress({ phase: event.phase, percent: event.percent, message: event.message })
      if (event.phase === 'completed' || event.phase === 'failed') {
        void queryClient.invalidateQueries({ queryKey: OPTIONAL_COMPONENTS_KEY })
        void queryClient.invalidateQueries({ queryKey: ['docling', 'service', 'status'] })
      }
    })
    return off
  }, [queryClient])

  useEffect(() => {
    if (!docling) return
    if (docling.status === 'installed' || docling.status === 'not_installed') {
      if (progress && progress.phase !== 'failed') setProgress(null)
    }
    if (docling.status === 'error' && progress?.phase !== 'failed') {
      setProgress({ phase: 'failed', percent: null, message: docling.error ?? undefined })
    }
  }, [docling, progress])

  const handleRefresh = useCallback(() => {
    void refetch()
    void refetchModels()
    void queryClient.invalidateQueries({ queryKey: ['docling', 'service', 'status'] })
  }, [queryClient, refetch, refetchModels])

  const handleInstall = useCallback(() => {
    setProgress({ phase: 'preparing', percent: null })
    action.mutate({ componentId: 'docling', action: 'install' })
  }, [action])

  const handleRepair = useCallback(() => {
    setProgress({ phase: 'preparing', percent: null })
    action.mutate({ componentId: 'docling', action: 'repair' })
  }, [action])

  const handleRemove = useCallback(() => setConfirmOpen(true), [])
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  const confirmRemove = useCallback(() => {
    setConfirmOpen(false)
    action.mutate({ componentId: 'docling', action: 'uninstall' })
  }, [action])

  const handleDownloadModels = useCallback(() => {
    downloadModels.mutate()
  }, [downloadModels])
  const handleDeleteModels = useCallback(() => {
    deleteModels.mutate()
  }, [deleteModels])
  const handleRepairModels = useCallback(() => {
    repairModels.mutate()
  }, [repairModels])

  return {
    docling,
    serviceStatus,
    modelStatus,
    isLoading: isLoading || isModelLoading,
    isBusy,
    isInstalled,
    progress,
    confirmOpen,
    actionPending: action.isPending,
    modelActionPending:
      downloadModels.isPending || deleteModels.isPending || repairModels.isPending,
    handleRefresh,
    handleInstall,
    handleRepair,
    handleRemove,
    closeConfirm,
    confirmRemove,
    handleDownloadModels,
    handleDeleteModels,
    handleRepairModels
  }
}
