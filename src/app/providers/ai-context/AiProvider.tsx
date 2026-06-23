import { useAiRegistry } from '@platform/electron/api/useAiApi'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'

import { useToastActions } from '@shared/stores/toastStore'

import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'

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

  // Keep a ref to tabs so openAiWorkspace doesn't need tabs in its dep array
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

  const tabsListValue = useMemo<AiTabsListSliceState>(() => ({ tabs }), [tabs])

  const tabFocusValue = useMemo<AiTabFocusSliceState>(
    () => ({
      activeTabId,
      currentAI
    }),
    [activeTabId, currentAI]
  )

  const viewRequestNonceValue = useMemo<AiViewRequestNonceState>(
    () => ({
      aiViewRequestNonce
    }),
    [aiViewRequestNonce]
  )

  const registryMetaValue = useMemo<AiRegistryMetaSliceState>(
    () => ({ isRegistryLoaded, chromeUserAgent }),
    [isRegistryLoaded, chromeUserAgent]
  )

  const aiSitesValue = useMemo(() => aiRegistry, [aiRegistry])

  const modelsCatalogValue = useMemo<AiModelsCatalogSliceState>(
    () => ({
      enabledModels,
      defaultAiModel,
      aiSites: aiRegistry
    }),
    [enabledModels, defaultAiModel, aiRegistry]
  )

  const sessionUiPrefsSliceValue = useMemo<AiSessionUiPrefsSliceState>(
    () => ({
      autoSend,
      isTutorialActive
    }),
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
    () => ({
      setCurrentAI,
      setEnabledModels,
      setDefaultAiModel
    }),
    [setCurrentAI, setEnabledModels, setDefaultAiModel]
  )

  const sessionActionsValue = useMemo<AiSessionActions>(
    () => ({
      setAutoSend,
      toggleAutoSend,
      startTutorial,
      stopTutorial
    }),
    [setAutoSend, toggleAutoSend, startTutorial, stopTutorial]
  )

  const webviewHostActionsValue = useMemo<AiWebviewHostActions>(
    () => ({
      registerWebview,
      reloadActiveWebview
    }),
    [registerWebview, reloadActiveWebview]
  )

  const messagingActionsValue = useMemo<AiMessagingActions>(
    () => ({
      sendTextToAI,
      sendImageToAI,
      cancelOngoing
    }),
    [sendTextToAI, sendImageToAI, cancelOngoing]
  )

  return (
    <AiSitesContext.Provider value={aiSitesValue}>
      <AiTabsListContext.Provider value={tabsListValue}>
        <AiTabFocusContext.Provider value={tabFocusValue}>
          <AiViewRequestNonceContext.Provider value={viewRequestNonceValue}>
            <AiRegistryMetaSliceContext.Provider value={registryMetaValue}>
              <AiModelsCatalogSliceContext.Provider value={modelsCatalogValue}>
                <AiSessionUiPrefsSliceContext.Provider value={sessionUiPrefsSliceValue}>
                  <AiWebviewContext.Provider value={webviewValue}>
                    <AiWebviewPresenceContext.Provider value={webviewPresenceValue}>
                      <AiTabActionsContext.Provider value={tabActionsValue}>
                        <AiModelActionsContext.Provider value={modelActionsValue}>
                          <AiSessionActionsContext.Provider value={sessionActionsValue}>
                            <AiCoreWorkspaceActionsContext.Provider
                              value={coreWorkspaceActionsValue}
                            >
                              <AiWebviewHostActionsContext.Provider value={webviewHostActionsValue}>
                                <AiMessagingActionsContext.Provider value={messagingActionsValue}>
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
