import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useAiRegistry } from '@platform/electron/api/useAiApi'
import { useGeminiWebStatus } from '@platform/electron/api/useGeminiWebSessionApi'
import { useToastActions } from '../ToastContext'
import { useAiMessaging } from '../ai/useAiMessaging'
import { useAiModelPreferences } from '../ai/useAiModelPreferences'
import { useAiTabs } from '../ai/useAiTabs'
import { useAiWebviewRegistry } from '../ai/useAiWebviewRegistry'
import {
  AiTabsListContext,
  AiTabFocusContext,
  AiRegistryMetaSliceContext,
  AiModelsCatalogSliceContext,
  AiSessionUiPrefsSliceContext,
  AiCoreWorkspaceActionsContext,
  AiWebviewHostActionsContext,
  AiMessagingActionsContext,
  AiWebviewContext,
  AiWebviewPresenceContext
} from './contexts'
import type {
  AiCoreWorkspaceActions,
  AiMessagingActions,
  AiModelsCatalogSliceState,
  AiRegistryMetaSliceState,
  AiSessionUiPrefsSliceState,
  AiTabFocusSliceState,
  AiTabsListSliceState,
  AiWebviewHostActions,
  AiWebviewPresenceState,
  AiWebviewState
} from '../ai/types'

export function AiProvider({ children }: { children: ReactNode }) {
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

  const reloadActiveWebview = useCallback(() => {
    webviewInstance?.reload?.()
  }, [webviewInstance])

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

  const tabsListValue = useMemo<AiTabsListSliceState>(() => ({ tabs }), [tabs])

  const tabFocusValue = useMemo<AiTabFocusSliceState>(
    () => ({
      activeTabId,
      aiViewRequestNonce,
      currentAI
    }),
    [activeTabId, aiViewRequestNonce, currentAI]
  )

  const registryMetaValue = useMemo<AiRegistryMetaSliceState>(
    () => ({ isRegistryLoaded, chromeUserAgent }),
    [isRegistryLoaded, chromeUserAgent]
  )

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

  const webviewValue = useMemo<AiWebviewState>(() => ({ webviewInstance }), [webviewInstance])

  const hasActiveWebview = webviewInstance != null
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
      sendImageToAI
    }),
    [sendTextToAI, sendImageToAI]
  )

  return (
    <AiTabsListContext.Provider value={tabsListValue}>
      <AiTabFocusContext.Provider value={tabFocusValue}>
        <AiRegistryMetaSliceContext.Provider value={registryMetaValue}>
          <AiModelsCatalogSliceContext.Provider value={modelsCatalogValue}>
            <AiSessionUiPrefsSliceContext.Provider value={sessionUiPrefsSliceValue}>
              <AiWebviewContext.Provider value={webviewValue}>
                <AiWebviewPresenceContext.Provider value={webviewPresenceValue}>
                  <AiCoreWorkspaceActionsContext.Provider value={coreWorkspaceActionsValue}>
                    <AiWebviewHostActionsContext.Provider value={webviewHostActionsValue}>
                      <AiMessagingActionsContext.Provider value={messagingActionsValue}>
                        {isRegistryLoaded && isTabsInitialized ? children : null}
                      </AiMessagingActionsContext.Provider>
                    </AiWebviewHostActionsContext.Provider>
                  </AiCoreWorkspaceActionsContext.Provider>
                </AiWebviewPresenceContext.Provider>
              </AiWebviewContext.Provider>
            </AiSessionUiPrefsSliceContext.Provider>
          </AiModelsCatalogSliceContext.Provider>
        </AiRegistryMetaSliceContext.Provider>
      </AiTabFocusContext.Provider>
    </AiTabsListContext.Provider>
  )
}
