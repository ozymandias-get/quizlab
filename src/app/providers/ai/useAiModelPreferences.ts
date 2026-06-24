import {
  DEFAULT_GOOGLE_WEB_SESSION_ENABLED_APP_IDS,
  GOOGLE_WEB_SESSION_REGISTRY_IDS
} from '@shared-core/constants/google-ai-web-apps'
import type { AiPlatform, AiRegistryResponse, GeminiWebSessionStatus } from '@shared-core/types'

import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage, useLocalStorageBoolean, useLocalStorageString } from '@shared/hooks'

import { useEffect, useMemo, useRef } from 'react'

import { areStringArraysEqual } from './tabUtils'
import type { PinnedTabStorage } from './types'

interface UseAiModelPreferencesParams {
  registryData?: AiRegistryResponse | null
  isLoading: boolean
  isError: boolean
  geminiWebStatus?: GeminiWebSessionStatus | null
}

export function useAiModelPreferences({
  registryData,
  isLoading,
  isError,
  geminiWebStatus
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

  // Use refs to access latest values inside effects without dep cycles
  const enabledModelsRef = useRef(enabledModels)
  enabledModelsRef.current = enabledModels
  const bootstrappedSiteIdsRef = useRef(bootstrappedSiteIds)
  bootstrappedSiteIdsRef.current = bootstrappedSiteIds
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Effect 1: Sync Google Web Session enabled models with registry
  useEffect(() => {
    if (!isRegistryLoaded || !geminiWebStatus || allAiIds.length === 0 || !isMountedRef.current)
      return

    const validIds = new Set(allAiIds)
    const googleRegistryIdSet = new Set<string>(GOOGLE_WEB_SESSION_REGISTRY_IDS)
    const googleEnabledIds = (geminiWebStatus.enabled ? enabledGoogleWebApps : []).filter(
      (id) => validIds.has(id) && googleRegistryIdSet.has(id)
    )
    const fallbackModelId = allAiIds.includes(defaultAiModel)
      ? defaultAiModel
      : allAiIds[0] || defaultAiId
    const currentEnabled = enabledModelsRef.current
    const nextEnabled = [
      ...currentEnabled.filter(
        (id) => !googleRegistryIdSet.has(id) || googleEnabledIds.includes(id)
      ),
      ...googleEnabledIds.filter((id) => !currentEnabled.includes(id))
    ]
    const normalizedEnabled = nextEnabled.length > 0 ? nextEnabled : [fallbackModelId]

    if (!areStringArraysEqual(normalizedEnabled, currentEnabled)) {
      setEnabledModels(normalizedEnabled)
    }
    // Only re-run when registry data or gemini status changes, not on every enabledModels change
  }, [
    isRegistryLoaded,
    geminiWebStatus,
    allAiIds,
    defaultAiId,
    defaultAiModel,
    enabledGoogleWebApps,
    setEnabledModels
  ])

  // Effect 2: Bootstrap built-in sites and validate selections
  useEffect(() => {
    if (!isRegistryLoaded || allAiIds.length === 0 || !isMountedRef.current) return

    const validIds = new Set(allAiIds)
    const fallbackModelId = validIds.has(defaultAiModel)
      ? defaultAiModel
      : allAiIds[0] || defaultAiId
    const builtInSiteIds = Object.values(aiRegistry)
      .filter((site) => site.isSite && !site.isCustom)
      .map((site) => site.id)
    const currentBootstrapped = bootstrappedSiteIdsRef.current
    const pendingBootstraps = builtInSiteIds.filter((id) => !currentBootstrapped.includes(id))

    const googleManaged = GOOGLE_WEB_SESSION_REGISTRY_IDS as readonly string[]
    const builtInModelIds = Object.values(aiRegistry)
      .filter((p) => !p.isSite && !p.isCustom && !googleManaged.includes(p.id))
      .map((p) => p.id)

    const currentEnabled = enabledModelsRef.current
    const filteredEnabled = currentEnabled.filter((id) => validIds.has(id))
    const seededEnabled = [
      ...filteredEnabled,
      ...pendingBootstraps.filter((id) => !filteredEnabled.includes(id)),
      ...builtInModelIds.filter((id) => !filteredEnabled.includes(id))
    ]
    const nextEnabled = seededEnabled.length > 0 ? seededEnabled : [fallbackModelId]

    if (!areStringArraysEqual(nextEnabled, currentEnabled)) {
      setEnabledModels(nextEnabled)
    }

    if (pendingBootstraps.length > 0) {
      setBootstrappedSiteIds([...currentBootstrapped, ...pendingBootstraps])
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
