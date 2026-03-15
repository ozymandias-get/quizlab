import { useEffect } from 'react'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import {
  DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
  GOOGLE_WEB_SESSION_REGISTRY_IDS
} from '@shared-core/constants/google-ai-web-apps'
import type { AiPlatform, AiRegistryResponse, GeminiWebSessionStatus } from '@shared-core/types'
import { useLocalStorage, useLocalStorageBoolean, useLocalStorageString } from '@shared/hooks'
import type { PinnedTabStorage } from './types'
import { areStringArraysEqual } from './tabUtils'

interface UseAiModelPreferencesParams {
  registryData?: AiRegistryResponse
  isLoading: boolean
  isError: boolean
  geminiWebStatus?: GeminiWebSessionStatus
}

export function useAiModelPreferences({
  registryData,
  isLoading,
  isError,
  geminiWebStatus
}: UseAiModelPreferencesParams) {
  const isRegistryLoaded = !isLoading && !isError && !!registryData
  const aiRegistry = (registryData?.aiRegistry || {}) as Record<string, AiPlatform>
  const defaultAiId = registryData?.defaultAiId || 'chatgpt'
  const allAiIds = registryData?.allAiIds || []
  const chromeUserAgent = registryData?.chromeUserAgent || ''

  const [lastSelectedAI, setLastSelectedAI] = useLocalStorageString(
    STORAGE_KEYS.LAST_SELECTED_AI,
    defaultAiId,
    allAiIds
  )
  const [enabledModels, setEnabledModels] = useLocalStorage<string[]>(
    STORAGE_KEYS.ENABLED_MODELS,
    allAiIds
  )
  const [bootstrappedSiteIds, setBootstrappedSiteIds] = useLocalStorage<string[]>(
    STORAGE_KEYS.BUILT_IN_SITE_BOOTSTRAP,
    []
  )
  const [enabledGoogleWebApps] = useLocalStorage<string[]>(
    'gwsEnabledApps',
    DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS
  )
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

  useEffect(() => {
    if (!isRegistryLoaded || !geminiWebStatus || allAiIds.length === 0) return

    const validIds = new Set(allAiIds)
    const googleRegistryIdSet = new Set<string>(GOOGLE_WEB_SESSION_REGISTRY_IDS)
    const googleEnabledIds = (geminiWebStatus.enabled ? enabledGoogleWebApps : []).filter(
      (id) => validIds.has(id) && googleRegistryIdSet.has(id)
    )
    const fallbackModelId = allAiIds.includes(defaultAiModel)
      ? defaultAiModel
      : allAiIds[0] || defaultAiId
    const nextEnabled = [
      ...enabledModels.filter(
        (id) => !googleRegistryIdSet.has(id) || googleEnabledIds.includes(id)
      ),
      ...googleEnabledIds.filter((id) => !enabledModels.includes(id))
    ]
    const normalizedEnabled = nextEnabled.length > 0 ? nextEnabled : [fallbackModelId]

    if (!areStringArraysEqual(normalizedEnabled, enabledModels)) {
      setEnabledModels(normalizedEnabled)
    }
  }, [
    isRegistryLoaded,
    geminiWebStatus,
    allAiIds,
    defaultAiId,
    defaultAiModel,
    enabledModels,
    enabledGoogleWebApps,
    setEnabledModels
  ])

  useEffect(() => {
    if (!isRegistryLoaded || allAiIds.length === 0) return

    const validIds = new Set(allAiIds)
    const fallbackModelId = validIds.has(defaultAiModel)
      ? defaultAiModel
      : allAiIds[0] || defaultAiId
    const builtInSiteIds = Object.values(aiRegistry)
      .filter((site) => site.isSite && !site.isCustom)
      .map((site) => site.id)
    const pendingBootstraps = builtInSiteIds.filter((id) => !bootstrappedSiteIds.includes(id))

    const filteredEnabled = enabledModels.filter((id) => validIds.has(id))
    const seededEnabled = [
      ...filteredEnabled,
      ...pendingBootstraps.filter((id) => !filteredEnabled.includes(id))
    ]
    const nextEnabled = seededEnabled.length > 0 ? seededEnabled : [fallbackModelId]

    if (!areStringArraysEqual(nextEnabled, enabledModels)) {
      setEnabledModels(nextEnabled)
    }

    if (pendingBootstraps.length > 0) {
      setBootstrappedSiteIds([...bootstrappedSiteIds, ...pendingBootstraps])
    }

    if (!validIds.has(defaultAiModel)) {
      setDefaultAiModel(nextEnabled[0] || fallbackModelId)
    }

    if (!validIds.has(lastSelectedAI)) {
      setLastSelectedAI(nextEnabled[0] || fallbackModelId)
    }
  }, [
    isRegistryLoaded,
    allAiIds,
    defaultAiId,
    aiRegistry,
    enabledModels,
    bootstrappedSiteIds,
    defaultAiModel,
    lastSelectedAI,
    setEnabledModels,
    setBootstrappedSiteIds,
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
    defaultAiModel,
    setDefaultAiModel,
    autoSend,
    setAutoSend,
    toggleAutoSend,
    pinnedTabs,
    setPinnedTabs
  }
}
