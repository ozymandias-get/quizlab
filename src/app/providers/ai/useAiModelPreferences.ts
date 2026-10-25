import type { AiPlatform, AiRegistryResponse } from '@shared-core/types'

import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage, useLocalStorageBoolean, useLocalStorageString } from '@shared/hooks'
import { useAppearance } from '@shared/stores/appearanceStore'

import { useCallback, useEffect, useMemo, useRef } from 'react'

import { areStringArraysEqual } from './tabUtils'
import type { PinnedTabStorage } from './types'

interface UseAiModelPreferencesParams {
  registryData?: AiRegistryResponse | null
  isLoading: boolean
  isError: boolean
}

export function useAiModelPreferences({
  registryData,
  isLoading,
  isError
}: UseAiModelPreferencesParams) {
  const isRegistryLoaded = !isLoading && !isError && !!registryData
  const aiRegistry = useMemo(
    () => (registryData?.aiRegistry ?? {}) as Record<string, AiPlatform>,
    [registryData?.aiRegistry]
  )
  const defaultAiId = registryData?.defaultAiId || 'chatgpt'
  const allAiIds = useMemo(() => registryData?.allAiIds ?? [], [registryData?.allAiIds])
  const chromeUserAgent = registryData?.chromeUserAgent || ''

  const [lastSelectedAI, setLastSelectedAI] = useLocalStorageString(
    STORAGE_KEYS.LAST_SELECTED_AI,
    defaultAiId,
    allAiIds
  )
  const [enabledModels, setEnabledModels] = useLocalStorage<string[]>(
    STORAGE_KEYS.ENABLED_MODELS,
    []
  )
  const [favoriteModels, setFavoriteModels] = useLocalStorage<string[]>(
    STORAGE_KEYS.FAVORITE_AI_MODELS,
    []
  )
  const setVisibleModel = useAppearance((state) => state.setVisibleModel)
  const toggleFavoriteModel = useCallback(
    (id: string) => {
      if (!Object.hasOwn(aiRegistry, id) || aiRegistry[id].isSite) return
      const adding = !favoriteModels.includes(id)
      setFavoriteModels((current) =>
        adding ? [...new Set([...current, id])] : current.filter((key) => key !== id)
      )
      if (adding) setEnabledModels((current) => (current.includes(id) ? current : [...current, id]))
      setVisibleModel(id, adding)
    },
    [aiRegistry, favoriteModels, setFavoriteModels, setEnabledModels, setVisibleModel]
  )

  useEffect(() => {
    if (!isRegistryLoaded) return
    const validFavorites = [...new Set(favoriteModels)].filter(
      (id) => Object.hasOwn(aiRegistry, id) && !aiRegistry[id].isSite
    )
    if (!areStringArraysEqual(validFavorites, favoriteModels)) setFavoriteModels(validFavorites)
  }, [isRegistryLoaded, aiRegistry, favoriteModels, setFavoriteModels])
  const [defaultAiModel, setDefaultAiModel] = useLocalStorageString(
    STORAGE_KEYS.DEFAULT_AI_MODEL,
    defaultAiId,
    allAiIds
  )
  const [autoSend, setAutoSend, toggleAutoSend] = useLocalStorageBoolean(
    STORAGE_KEYS.AUTO_SEND_ENABLED,
    false
  )
  const [pinnedTabs, setPinnedTabs] = useLocalStorage<PinnedTabStorage[]>(
    STORAGE_KEYS.PINNED_AI_TABS,
    []
  )

  // Use refs to access latest values inside effects without dep cycles
  const enabledModelsRef = useRef(enabledModels)
  enabledModelsRef.current = enabledModels
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Seed an empty profile once; never re-enable a model the user switched off.
  useEffect(() => {
    if (!isRegistryLoaded || allAiIds.length === 0 || !isMountedRef.current) return

    const validIds = new Set(allAiIds)
    const fallbackModelId = validIds.has(defaultAiModel)
      ? defaultAiModel
      : allAiIds[0] || defaultAiId
    const currentEnabled = enabledModelsRef.current
    const filteredEnabled = currentEnabled.filter((id) => validIds.has(id))
    const defaultEnabled = Object.values(aiRegistry)
      .filter((platform) => !platform.isCustom && platform.defaultEnabled !== false)
      .map((platform) => platform.id)
    const nextEnabled =
      filteredEnabled.length > 0
        ? filteredEnabled
        : defaultEnabled.length > 0
          ? defaultEnabled
          : [fallbackModelId]

    if (!areStringArraysEqual(nextEnabled, currentEnabled)) {
      setEnabledModels(nextEnabled)
    }

    if (!validIds.has(defaultAiModel)) {
      setDefaultAiModel(nextEnabled[0] || fallbackModelId)
    }

    if (!validIds.has(lastSelectedAI)) {
      setLastSelectedAI(nextEnabled[0] || fallbackModelId)
    }
    // Only re-run when registry loads or aiRegistry structure changes
  }, [
    isRegistryLoaded,
    allAiIds,
    defaultAiId,
    defaultAiModel,
    aiRegistry,
    lastSelectedAI,
    setEnabledModels,
    setDefaultAiModel,
    setLastSelectedAI
  ])

  return {
    isRegistryLoaded,
    aiRegistry,
    defaultAiId,
    allAiIds,
    chromeUserAgent,
    lastSelectedAI,
    setLastSelectedAI,
    enabledModels,
    setEnabledModels,
    favoriteModels,
    setFavoriteModels,
    toggleFavoriteModel,
    defaultAiModel,
    setDefaultAiModel,
    autoSend,
    setAutoSend,
    toggleAutoSend,
    pinnedTabs,
    setPinnedTabs
  }
}
