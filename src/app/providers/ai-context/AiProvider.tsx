import { useAiRegistry } from '@platform/electron/api/useAiApi'

import { useChatUiStore } from '@features/ai'

import { retireManagedView } from '@shared/hooks/aiContent/managedViewLifecycle'
import { useToastActions } from '@shared/stores/toastStore'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAiContentRegistry } from '../ai/useAiContentRegistry'
import { useAiMessaging } from '../ai/useAiMessaging'
import { useAiModelPreferences } from '../ai/useAiModelPreferences'
import { useAiTabs } from '../ai/useAiTabs'
import {
  AiContentContext,
  AiContentHostActionsContext,
  AiContentPresenceContext,
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

/** Undo window shown when a tab is closed, matching the draft-item toast. */
const TAB_UNDO_TOAST_MS = 5000

/**
 * Teardown outlives the toast on purpose. The toast pauses its dismiss timer
 * while hovered or focused, so a fixed 5s teardown could destroy the tab (and
 * its composer state) while the Undo button was still on screen.
 */
const TAB_TEARDOWN_RETENTION_MS = 30_000

function AiProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { showWarning, addToast } = useToastActions()
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
    restoreTab,
    setActiveTab,
    renameTab,
    togglePinTab
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

  // Deferred teardown for a just-closed tab. Registry cleanup and the chat-UI
  // reset are irreversible, so they wait out the undo window: an undo brings the
  // tab back together with the composer state (typed input, attachments) it
  // owned. The hosted site itself is reconciled by the app-level live view set,
  // so an undo after a close may reload the page — the tab and its own state
  // still come back.
  const pendingTabTeardownsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const runClosedTabTeardown = useCallback(
    (tabId: string) => {
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
    [registerContent]
  )

  const cancelClosedTabTeardown = useCallback((tabId: string) => {
    const pending = pendingTabTeardownsRef.current
    const timer = pending.get(tabId)
    if (timer === undefined) return
    clearTimeout(timer)
    pending.delete(tabId)
  }, [])

  useEffect(() => {
    const pending = pendingTabTeardownsRef.current
    return () => {
      // The provider only unmounts with the app; there is no undo surface left
      // to keep the buffer for, and a timer firing after teardown would act on
      // a dead registry.
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const currentTabs = tabsRef.current
      const tabToClose = currentTabs.find((tab) => tab.id === tabId)
      if (!tabToClose) return
      const closedIndex = currentTabs.findIndex((tab) => tab.id === tabId)
      const wasActive = activeTabIdRef.current === tabId

      closeTab(tabId)
      cancelClosedTabTeardown(tabId)

      const toastId = addToast({
        type: 'info',
        message: 'ai_tab_closed',
        params: { name: tabToClose.title?.trim() || tabToClose.modelId },
        duration: TAB_UNDO_TOAST_MS,
        actionLabel: 'undo',
        onAction: () => {
          cancelClosedTabTeardown(tabId)
          restoreTab(tabToClose, { index: closedIndex, activate: wasActive })
        }
      })

      // Notifications are off for info toasts: no undo surface was shown, so the
      // irreversible cleanup must not wait for a window nobody can use.
      if (!toastId) {
        runClosedTabTeardown(tabId)
        return
      }

      pendingTabTeardownsRef.current.set(
        tabId,
        setTimeout(() => {
          pendingTabTeardownsRef.current.delete(tabId)
          runClosedTabTeardown(tabId)
        }, TAB_TEARDOWN_RETENTION_MS)
      )
    },
    [addToast, cancelClosedTabTeardown, closeTab, restoreTab, runClosedTabTeardown]
  )

  const reloadActiveContent = useCallback(() => {
    getContentController()?.reload?.()
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
    openAiWorkspace,
    renameTab,
    togglePinTab,
    setEnabledModels,
    favoriteModels,
    setFavoriteModels,
    toggleFavoriteModel,
    setDefaultAiModel,
    setAutoSend,
    toggleAutoSend,
    registerContent,
    reloadActiveContent,
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
                                      className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-ring/70 text-ql-14 rounded-lg border px-4 py-2 font-medium focus-visible:ring-2 focus-visible:outline-none"
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
