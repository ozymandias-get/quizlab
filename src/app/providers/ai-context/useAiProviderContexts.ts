import { useMemo } from 'react'

import type {
  AiCoreWorkspaceActions,
  AiMessagingActions,
  AiModelActions,
  AiModelsCatalogSliceState,
  AiRegistryMetaSliceState,
  AiSessionActions,
  AiSessionUiPrefsSliceState,
  AiTabActions,
  AiTabFocusSliceState,
  AiTabsListSliceState,
  AiViewRequestNonceState,
  AiWebviewHostActions,
  AiWebviewPresenceState,
  AiWebviewState
} from '../ai/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface UseAiProviderContextsParams {
  tabs: unknown[]
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
  getWebviewInstance: (tabId?: string) => unknown
  hasActiveWebview: boolean
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
  registerWebview: (id: string, instance: unknown) => void
  reloadActiveWebview: () => void
  sendTextToAI: (text: string, options?: unknown) => Promise<unknown>
  sendImageToAI: (imageData: string, options?: unknown) => Promise<unknown>
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
    getWebviewInstance,
    hasActiveWebview,
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
    registerWebview,
    reloadActiveWebview,
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

  const webviewValue = useMemo<AiWebviewState>(() => ({ getWebviewInstance }), [getWebviewInstance])

  const webviewPresenceValue = useMemo<AiWebviewPresenceState>(
    () => ({ hasActiveWebview }),
    [hasActiveWebview]
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

  const webviewHostActionsValue = useMemo<AiWebviewHostActions>(
    () => ({ registerWebview, reloadActiveWebview }),
    [registerWebview, reloadActiveWebview]
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
    webviewValue,
    webviewPresenceValue,
    coreWorkspaceActionsValue,
    tabActionsValue,
    modelActionsValue,
    sessionActionsValue,
    webviewHostActionsValue,
    messagingActionsValue
  }
}
