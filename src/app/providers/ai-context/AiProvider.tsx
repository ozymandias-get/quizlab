import { useAiRegistry } from '@platform/electron/api/useAiApi'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'

import { useToastActions } from '@shared/stores/toastStore'

import { type ReactNode, useCallback, useRef, useState } from 'react'

import { useAiMessaging } from '../ai/useAiMessaging'
import { useAiModelPreferences } from '../ai/useAiModelPreferences'
import { useAiTabs } from '../ai/useAiTabs'
import { useAiWebviewRegistry } from '../ai/useAiWebviewRegistry'
import {
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
  AiViewRequestNonceContext,
  AiWebviewContext,
  AiWebviewHostActionsContext,
  AiWebviewPresenceContext
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

  const { registerWebview, getWebviewInstance, hasActiveWebview } =
    useAiWebviewRegistry(activeTabId)

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

  const { sendTextToAI, sendImageToAI, cancelOngoing } = useAiMessaging({
    getWebviewInstance,
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
      registerWebview(tabId, null)
    },
    [closeTab, registerWebview]
  )

  const reloadActiveWebview = useCallback(() => {
    getWebviewInstance()?.reload?.()
  }, [getWebviewInstance])

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
                  <AiWebviewContext.Provider value={contextValues.webviewValue}>
                    <AiWebviewPresenceContext.Provider value={contextValues.webviewPresenceValue}>
                      <AiTabActionsContext.Provider value={contextValues.tabActionsValue}>
                        <AiModelActionsContext.Provider value={contextValues.modelActionsValue}>
                          <AiSessionActionsContext.Provider
                            value={contextValues.sessionActionsValue}
                          >
                            <AiCoreWorkspaceActionsContext.Provider
                              value={contextValues.coreWorkspaceActionsValue}
                            >
                              <AiWebviewHostActionsContext.Provider
                                value={contextValues.webviewHostActionsValue}
                              >
                                <AiMessagingActionsContext.Provider
                                  value={contextValues.messagingActionsValue}
                                >
                                  {isRegistryLoaded && isTabsInitialized ? children : null}
                                </AiMessagingActionsContext.Provider>
                              </AiWebviewHostActionsContext.Provider>
                            </AiCoreWorkspaceActionsContext.Provider>
                          </AiSessionActionsContext.Provider>
                        </AiModelActionsContext.Provider>
                      </AiTabActionsContext.Provider>
                    </AiWebviewPresenceContext.Provider>
                  </AiWebviewContext.Provider>
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
