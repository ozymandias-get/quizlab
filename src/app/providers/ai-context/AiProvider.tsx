import { useAiRegistry } from '@platform/electron/api/useAiApi'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'

import { useChatUiStore } from '@features/ai'

import { retireManagedView } from '@shared/hooks/aiContent/managedViewLifecycle'
import { useToastActions } from '@shared/stores/toastStore'

import { type ReactNode, useCallback, useRef, useState } from 'react'

import { useAiContentRegistry } from '../ai/useAiContentRegistry'
import { useAiMessaging } from '../ai/useAiMessaging'
import { useAiModelPreferences } from '../ai/useAiModelPreferences'
import { useAiTabs } from '../ai/useAiTabs'
import {
  AiContentContext,
  AiContentHostActionsContext,
  AiContentPresenceContext,
  AiCoreWorkspaceActionsContext,
  AiMessagingActionsContext,
  AiModelActionsContext,
  AiModelsCatalogSliceContext,
  AiRegistryMetaSliceContext,
  AiSessionActionsContext,
  AiSessionUiPrefsSliceContext,
  AiSitesContext,
  AiTabActionsContext,
  AiTabFocusContext,
  AiTabsListContext,
  AiViewRequestNonceContext
} from './contexts'
import { useAiProviderContexts } from './useAiProviderContexts'

function AiProvider({ children }: { children: ReactNode }) {
  const { showSuccess, showWarning } = useToastActions()
  const { data: registryData, isLoading, isError } = useAiRegistry()
  const { data: geminiWebStatus } = useGeminiWebStatus()
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

  const { registerContent, getContentController, hasActiveContent } =
    useAiContentRegistry(activeTabId)

  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const openAiWorkspace = useCallback(
    (modelId: string) => {
      const existingTab = tabsRef.current.find((tab) => tab.modelId === modelId)

      if (existingTab) {
        setActiveTab(existingTab.id)
      } else {
        addTab(modelId)
      }
      setAiViewRequestNonce((current) => current + 1)
    },
    [addTab, setActiveTab]
  )

  const getActiveTab = useCallback(
    () => tabsRef.current.find((tab) => tab.id === activeTabId),
    [activeTabId]
  )

  const { sendTextToAI, sendImageToAI, cancelOngoing } = useAiMessaging({
    getContentController,
    getActiveTab,
    currentAI,
    activeTabId,
    autoSend,
    aiRegistry,
    showSuccess,
    showWarning,
    openAiWorkspace
  })

  const handleCloseTab = useCallback(
    (tabId: string) => {
      closeTab(tabId)
      // Two independent teardowns, deliberately not one: dropping the registry
      // entry only stops the messaging / picker pipelines from addressing a tab
      // that no longer exists, while retiring the managed view is what actually
      // closes the main-process `WebContents`. Doing only the former left the
      // renderer process for every closed tab running in the background.
      registerContent(tabId, null)
      void retireManagedView(tabId)
      // Drop the closed tab's per-tab chat UI state (input, attachments,
      // streaming buffers...). Tab ids are never reused, so leaving entries
      // behind only leaks memory and risks stale-state reads.
      useChatUiStore.getState().resetTabState(tabId)
    },
    [closeTab, registerContent]
  )

  const reloadActiveContent = useCallback(() => {
    getContentController()?.reload?.()
  }, [getContentController])

  const startTutorial = useCallback(() => {
    setIsTutorialActive(true)
  }, [])

  const stopTutorial = useCallback(() => {
    setIsTutorialActive(false)
  }, [])

  const contextValues = useAiProviderContexts({
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
  })

  return (
    <AiSitesContext.Provider value={contextValues.aiSitesValue}>
      <AiTabsListContext.Provider value={contextValues.tabsListValue}>
        <AiTabFocusContext.Provider value={contextValues.tabFocusValue}>
          <AiViewRequestNonceContext.Provider value={contextValues.viewRequestNonceValue}>
            <AiRegistryMetaSliceContext.Provider value={contextValues.registryMetaValue}>
              <AiModelsCatalogSliceContext.Provider value={contextValues.modelsCatalogValue}>
                <AiSessionUiPrefsSliceContext.Provider
                  value={contextValues.sessionUiPrefsSliceValue}
                >
                  <AiContentContext.Provider value={contextValues.contentValue}>
                    <AiContentPresenceContext.Provider value={contextValues.contentPresenceValue}>
                      <AiTabActionsContext.Provider value={contextValues.tabActionsValue}>
                        <AiModelActionsContext.Provider value={contextValues.modelActionsValue}>
                          <AiSessionActionsContext.Provider
                            value={contextValues.sessionActionsValue}
                          >
                            <AiCoreWorkspaceActionsContext.Provider
                              value={contextValues.coreWorkspaceActionsValue}
                            >
                              <AiContentHostActionsContext.Provider
                                value={contextValues.contentHostActionsValue}
                              >
                                <AiMessagingActionsContext.Provider
                                  value={contextValues.messagingActionsValue}
                                >
                                  {isRegistryLoaded && isTabsInitialized ? children : null}
                                </AiMessagingActionsContext.Provider>
                              </AiContentHostActionsContext.Provider>
                            </AiCoreWorkspaceActionsContext.Provider>
                          </AiSessionActionsContext.Provider>
                        </AiModelActionsContext.Provider>
                      </AiTabActionsContext.Provider>
                    </AiContentPresenceContext.Provider>
                  </AiContentContext.Provider>
                </AiSessionUiPrefsSliceContext.Provider>
              </AiModelsCatalogSliceContext.Provider>
            </AiRegistryMetaSliceContext.Provider>
          </AiViewRequestNonceContext.Provider>
        </AiTabFocusContext.Provider>
      </AiTabsListContext.Provider>
    </AiSitesContext.Provider>
  )
}

export default AiProvider
