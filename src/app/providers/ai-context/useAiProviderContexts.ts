import type { AiContentController } from '@shared-core/types/aiContent'

import type { AiSendOptions } from '@features/ai'

import { useMemo } from 'react'

import type {
  AiContentHostActions,
  AiContentPresenceState,
  AiContentState,
  AiCoreWorkspaceActions,
  AiMessagingActions,
  AiModelActions,
  AiModelsCatalogSliceState,
  AiRegistryMetaSliceState,
  AiSendResult,
  AiSessionActions,
  AiSessionUiPrefsSliceState,
  AiTabActions,
  AiTabFocusSliceState,
  AiTabsListSliceState,
  AiViewRequestNonceState,
  Tab
} from '../ai/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface UseAiProviderContextsParams {
  tabs: Tab[]
  activeTabId: string
  currentAI: string
  aiViewRequestNonce: number
  isRegistryLoaded: boolean
  chromeUserAgent: string
  aiRegistry: AnyRecord
  enabledModels: string[]
  favoriteModels: string[]
  defaultAiModel: string
  autoSend: boolean
  getContentController: (tabId?: string) => AiContentController | null
  hasActiveContent: boolean
  addTab: (modelId: string) => void
  handleCloseTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  openAiWorkspace: (modelId: string) => void
  renameTab: (tabId: string, title?: string) => void
  togglePinTab: (tabId: string) => void
  setCurrentAI: (id: string) => void
  setEnabledModels: (models: string[]) => void
  setFavoriteModels: (models: string[]) => void
  toggleFavoriteModel: (model: string) => void
  setDefaultAiModel: (model: string) => void
  setAutoSend: (value: boolean) => void
  toggleAutoSend: () => void
  registerContent: (id: string, instance: AiContentController | null) => void
  reloadActiveContent: () => void
  recreateActiveContent: () => void
  sendTextToAI: (text: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendImageToAI: (imageData: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendBulkToAI?: (imageDataUrls: string[], options?: AiSendOptions) => Promise<AiSendResult>
  cancelOngoing: () => void
}

export function useAiProviderContexts(params: UseAiProviderContextsParams) {
  const {
    tabs,
    activeTabId,
    currentAI,
    aiViewRequestNonce,
    isRegistryLoaded,
    chromeUserAgent,
    aiRegistry,
    enabledModels,
    favoriteModels,
    defaultAiModel,
    autoSend,
    getContentController,
    hasActiveContent,
    addTab,
    handleCloseTab,
    setActiveTab,
    openAiWorkspace,
    renameTab,
    togglePinTab,
    setCurrentAI,
    setEnabledModels,
    setFavoriteModels,
    toggleFavoriteModel,
    setDefaultAiModel,
    setAutoSend,
    toggleAutoSend,
    registerContent,
    reloadActiveContent,
    recreateActiveContent,
    sendTextToAI,
    sendImageToAI,
    sendBulkToAI,
    cancelOngoing
  } = params

  const tabsListValue = useMemo<AiTabsListSliceState>(() => ({ tabs }), [tabs])

  const tabFocusValue = useMemo<AiTabFocusSliceState>(
    () => ({ activeTabId, currentAI }),
    [activeTabId, currentAI]
  )

  const viewRequestNonceValue = useMemo<AiViewRequestNonceState>(
    () => ({ aiViewRequestNonce }),
    [aiViewRequestNonce]
  )

  const registryMetaValue = useMemo<AiRegistryMetaSliceState>(
    () => ({ isRegistryLoaded, chromeUserAgent }),
    [isRegistryLoaded, chromeUserAgent]
  )

  const aiSitesValue = useMemo(() => aiRegistry, [aiRegistry])

  const modelsCatalogValue = useMemo<AiModelsCatalogSliceState>(
    () => ({ enabledModels, favoriteModels, defaultAiModel, aiSites: aiRegistry }),
    [enabledModels, favoriteModels, defaultAiModel, aiRegistry]
  )

  const sessionUiPrefsSliceValue = useMemo<AiSessionUiPrefsSliceState>(
    () => ({ autoSend }),
    [autoSend]
  )

  const contentValue = useMemo<AiContentState>(
    () => ({ getContentController }),
    [getContentController]
  )

  const contentPresenceValue = useMemo<AiContentPresenceState>(
    () => ({ hasActiveContent }),
    [hasActiveContent]
  )

  const coreWorkspaceActionsValue = useMemo<AiCoreWorkspaceActions>(
    () => ({
      addTab,
      closeTab: handleCloseTab,
      setActiveTab,
      openAiWorkspace,
      renameTab,
      togglePinTab,
      setCurrentAI,
      setEnabledModels,
      setFavoriteModels,
      toggleFavoriteModel,
      setDefaultAiModel,
      setAutoSend,
      toggleAutoSend
    }),
    [
      addTab,
      handleCloseTab,
      setActiveTab,
      openAiWorkspace,
      renameTab,
      togglePinTab,
      setCurrentAI,
      setEnabledModels,
      setFavoriteModels,
      toggleFavoriteModel,
      setDefaultAiModel,
      setAutoSend,
      toggleAutoSend
    ]
  )

  const tabActionsValue = useMemo<AiTabActions>(
    () => ({
      addTab,
      closeTab: handleCloseTab,
      setActiveTab,
      openAiWorkspace,
      renameTab,
      togglePinTab
    }),
    [addTab, handleCloseTab, setActiveTab, openAiWorkspace, renameTab, togglePinTab]
  )

  const modelActionsValue = useMemo<AiModelActions>(
    () => ({
      setCurrentAI,
      setEnabledModels,
      setDefaultAiModel,
      setFavoriteModels,
      toggleFavoriteModel
    }),
    [setCurrentAI, setEnabledModels, setDefaultAiModel, setFavoriteModels, toggleFavoriteModel]
  )

  const sessionActionsValue = useMemo<AiSessionActions>(
    () => ({ setAutoSend, toggleAutoSend }),
    [setAutoSend, toggleAutoSend]
  )

  const contentHostActionsValue = useMemo<AiContentHostActions>(
    () => ({ registerContent, reloadActiveContent, recreateActiveContent }),
    [registerContent, reloadActiveContent, recreateActiveContent]
  )

  const messagingActionsValue = useMemo<AiMessagingActions>(
    () => ({ sendTextToAI, sendImageToAI, sendBulkToAI, cancelOngoing }),
    [sendTextToAI, sendImageToAI, sendBulkToAI, cancelOngoing]
  )

  return {
    tabsListValue,
    tabFocusValue,
    viewRequestNonceValue,
    registryMetaValue,
    aiSitesValue,
    modelsCatalogValue,
    sessionUiPrefsSliceValue,
    contentValue,
    contentPresenceValue,
    coreWorkspaceActionsValue,
    tabActionsValue,
    modelActionsValue,
    sessionActionsValue,
    contentHostActionsValue,
    messagingActionsValue
  }
}
