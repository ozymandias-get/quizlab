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
  defaultAiModel: string
  autoSend: boolean
  isTutorialActive: boolean
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
  setDefaultAiModel: (model: string) => void
  setAutoSend: (value: boolean) => void
  toggleAutoSend: () => void
  startTutorial: () => void
  stopTutorial: () => void
  registerContent: (id: string, instance: AiContentController | null) => void
  reloadActiveContent: () => void
  sendTextToAI: (text: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendImageToAI: (imageData: string, options?: AiSendOptions) => Promise<AiSendResult>
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
    defaultAiModel,
    autoSend,
    isTutorialActive,
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
    setDefaultAiModel,
    setAutoSend,
    toggleAutoSend,
    startTutorial,
    stopTutorial,
    registerContent,
    reloadActiveContent,
    sendTextToAI,
    sendImageToAI,
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
    () => ({ enabledModels, defaultAiModel, aiSites: aiRegistry }),
    [enabledModels, defaultAiModel, aiRegistry]
  )

  const sessionUiPrefsSliceValue = useMemo<AiSessionUiPrefsSliceState>(
    () => ({ autoSend, isTutorialActive }),
    [autoSend, isTutorialActive]
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
      setDefaultAiModel,
      setAutoSend,
      toggleAutoSend,
      startTutorial,
      stopTutorial
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
      setDefaultAiModel,
      setAutoSend,
      toggleAutoSend,
      startTutorial,
      stopTutorial
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
    () => ({ setCurrentAI, setEnabledModels, setDefaultAiModel }),
    [setCurrentAI, setEnabledModels, setDefaultAiModel]
  )

  const sessionActionsValue = useMemo<AiSessionActions>(
    () => ({ setAutoSend, toggleAutoSend, startTutorial, stopTutorial }),
    [setAutoSend, toggleAutoSend, startTutorial, stopTutorial]
  )

  const contentHostActionsValue = useMemo<AiContentHostActions>(
    () => ({ registerContent, reloadActiveContent }),
    [registerContent, reloadActiveContent]
  )

  const messagingActionsValue = useMemo<AiMessagingActions>(
    () => ({ sendTextToAI, sendImageToAI, cancelOngoing }),
    [sendTextToAI, sendImageToAI, cancelOngoing]
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
