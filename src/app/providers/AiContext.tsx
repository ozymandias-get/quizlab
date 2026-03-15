import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useAiRegistry, useRefreshAiRegistry } from '@platform/electron/api/useAiApi'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'
import { useToast } from './ToastContext'
import { useAiMessaging } from './ai/useAiMessaging'
import { useAiModelPreferences } from './ai/useAiModelPreferences'
import { useAiTabs } from './ai/useAiTabs'
import { useAiWebviewRegistry } from './ai/useAiWebviewRegistry'
import type { AiContextActions, AiContextState, AiContextType } from './ai/types'

export type { Tab } from './ai/types'

const AiStateContext = createContext<AiContextState | null>(null)
const AiActionsContext = createContext<AiContextActions | null>(null)

export function AiProvider({ children }: { children: React.ReactNode }) {
  const { showSuccess, showWarning } = useToast()
  const { data: registryData, isLoading, isError } = useAiRegistry()
  const { data: geminiWebStatus } = useGeminiWebStatus()
  const refreshMutation = useRefreshAiRegistry()
  const [isTutorialActive, setIsTutorialActive] = useState(false)
  const [aiViewRequestNonce, setAiViewRequestNonce] = useState(0)

  const {
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
  } = useAiModelPreferences({
    registryData,
    isLoading,
    isError,
    geminiWebStatus
  })

  const {
    tabs,
    activeTabId,
    currentAI,
    isTabsInitialized,
    addTab,
    closeTab,
    setActiveTab,
    renameTab,
    togglePinTab,
    setCurrentAI
  } = useAiTabs({
    isRegistryLoaded,
    allAiIds,
    defaultAiId,
    defaultAiModel,
    lastSelectedAI,
    setLastSelectedAI,
    pinnedTabs,
    setPinnedTabs
  })

  const { registerWebview, webviewInstance } = useAiWebviewRegistry(activeTabId)

  const { sendTextToAI, sendImageToAI } = useAiMessaging({
    webviewInstance,
    currentAI,
    activeTabId,
    autoSend,
    aiRegistry,
    showSuccess,
    showWarning
  })

  const handleCloseTab = useCallback(
    (tabId: string) => {
      closeTab(tabId)
      registerWebview(tabId, null)
    },
    [closeTab, registerWebview]
  )

  const refreshRegistry = useCallback(
    async (force = false) => {
      if (!force) return

      try {
        await refreshMutation.mutateAsync()
        showSuccess('toast_registry_refreshed')
      } catch {
        showWarning('toast_registry_load_error')
      }
    },
    [refreshMutation, showSuccess, showWarning]
  )

  const startTutorial = useCallback(() => {
    setIsTutorialActive(true)
  }, [])

  const stopTutorial = useCallback(() => {
    setIsTutorialActive(false)
  }, [])

  const openAiWorkspace = useCallback(
    (modelId: string) => {
      const existingTab = tabs.find((tab) => tab.modelId === modelId)

      if (existingTab) {
        setActiveTab(existingTab.id)
      } else {
        addTab(modelId)
      }

      setAiViewRequestNonce((current) => current + 1)
    },
    [addTab, setActiveTab, tabs]
  )

  const stateValue = useMemo<AiContextState>(
    () => ({
      isRegistryLoaded,
      chromeUserAgent,
      tabs,
      activeTabId,
      aiViewRequestNonce,
      currentAI,
      enabledModels,
      defaultAiModel,
      aiSites: aiRegistry,
      autoSend,
      webviewInstance,
      isTutorialActive
    }),
    [
      isRegistryLoaded,
      chromeUserAgent,
      tabs,
      activeTabId,
      aiViewRequestNonce,
      currentAI,
      enabledModels,
      defaultAiModel,
      aiRegistry,
      autoSend,
      webviewInstance,
      isTutorialActive
    ]
  )

  const actionsValue = useMemo<AiContextActions>(
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
      registerWebview,
      sendTextToAI,
      sendImageToAI,
      refreshRegistry,
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
      registerWebview,
      sendTextToAI,
      sendImageToAI,
      refreshRegistry,
      startTutorial,
      stopTutorial
    ]
  )

  return (
    <AiStateContext.Provider value={stateValue}>
      <AiActionsContext.Provider value={actionsValue}>
        {isRegistryLoaded && isTabsInitialized ? children : null}
      </AiActionsContext.Provider>
    </AiStateContext.Provider>
  )
}

export const useAiState = () => {
  const context = useContext(AiStateContext)
  if (!context) throw new Error('useAiState must be used within AiProvider')
  return context
}

export const useAiActions = () => {
  const context = useContext(AiActionsContext)
  if (!context) throw new Error('useAiActions must be used within AiProvider')
  return context
}

export const useAi = (): AiContextType => {
  const state = useAiState()
  const actions = useAiActions()

  return useMemo(
    () => ({
      ...state,
      ...actions
    }),
    [state, actions]
  )
}
