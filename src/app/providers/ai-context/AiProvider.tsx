import { useAiRegistry } from '@platform/electron/api/useAiApi'

import { useChatUiStore } from '@features/ai'

import { retireManagedView } from '@shared/hooks/aiContent/managedViewLifecycle'
import { useToastActions } from '@shared/stores/toastStore'

import { type ReactNode, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const { showWarning } = useToastActions()
  const { data: registryData, isLoading, isError, refetch } = useAiRegistry()
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
    favoriteModels,
    setFavoriteModels,
    toggleFavoriteModel,
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
    isError
  })

  const {
    tabs,
    activeTabId,
    currentAI,
    isTabsInitialized,
    addTab,
    closeTab,
    setActiveTab,
    setTabSessionSlot,
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
  // `getActiveTab` is called from async send paths that outlive the render that
  // opened an api-chat tab. Reading the id through a ref keeps those calls from
  // polling the tab that used to be active.
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId

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
    () => tabsRef.current.find((tab) => tab.id === activeTabIdRef.current),
    []
  )

  const { sendTextToAI, sendImageToAI, sendBulkToAI, cancelOngoing } = useAiMessaging({
    getContentController,
    getActiveTab,
    currentAI,
    activeTabId,
    autoSend,
    aiRegistry,
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

  const recreateActiveContent = useCallback(() => {
    const controller = getContentController() as {
      recreate?: () => void
      reload?: () => void
    } | null
    if (typeof controller?.recreate === 'function') {
      void controller.recreate()
    } else {
      controller?.reload?.()
    }
  }, [getContentController])

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
    getContentController,
    hasActiveContent,
    addTab,
    handleCloseTab,
    setActiveTab,
    setTabSessionSlot,
    openAiWorkspace,
    renameTab,
    togglePinTab,
    setCurrentAI,
    setEnabledModels,
    favoriteModels,
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
                                  {isError ? (
                                    <div
                                      role="alert"
                                      className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-3 p-6 text-center"
                                    >
                                      <p className="text-foreground text-ql-14 font-medium">
                                        {t('error_registry_not_loaded')}
                                      </p>
                                      <button
                                        type="button"
                                        className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-ring/40 rounded-lg border px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                                        onClick={() => void refetch()}
                                      >
                                        {t('try_again')}
                                      </button>
                                    </div>
                                  ) : isRegistryLoaded && isTabsInitialized ? (
                                    children
                                  ) : null}
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
