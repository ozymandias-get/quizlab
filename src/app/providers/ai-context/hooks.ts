import { useContext, useMemo } from 'react'
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
  AiCatalogSliceState,
  AiContextActions,
  AiContextState,
  AiContextType,
  AiCoreWorkspaceActions,
  AiMessagingActions,
  AiModelsCatalogSliceState,
  AiRegistryMetaSliceState,
  AiRegistryPrefsSliceState,
  AiSessionUiPrefsSliceState,
  AiTabFocusSliceState,
  AiTabsListSliceState,
  AiTabsSliceState,
  AiWebviewHostActions,
  AiWebviewPresenceState
} from '../ai/types'

export const useAiState = (): AiContextState => {
  const tabsList = useContext(AiTabsListContext)
  const tabFocus = useContext(AiTabFocusContext)
  const registryMeta = useContext(AiRegistryMetaSliceContext)
  const modelsCatalog = useContext(AiModelsCatalogSliceContext)
  const sessionPrefsSlice = useContext(AiSessionUiPrefsSliceContext)
  if (!tabsList || !tabFocus || !registryMeta || !modelsCatalog || !sessionPrefsSlice) {
    throw new Error('useAiState must be used within AiProvider')
  }
  return useMemo(
    () => ({ ...tabsList, ...tabFocus, ...registryMeta, ...modelsCatalog, ...sessionPrefsSlice }),
    [tabsList, tabFocus, registryMeta, modelsCatalog, sessionPrefsSlice]
  )
}

export const useAiTabsList = (): AiTabsListSliceState => {
  const context = useContext(AiTabsListContext)
  if (!context) {
    throw new Error('useAiTabsList must be used within AiProvider')
  }
  return context
}

export const useAiTabFocus = (): AiTabFocusSliceState => {
  const context = useContext(AiTabFocusContext)
  if (!context) {
    throw new Error('useAiTabFocus must be used within AiProvider')
  }
  return context
}

export const useAiTabsSliceState = (): AiTabsSliceState => {
  const tabsList = useContext(AiTabsListContext)
  const tabFocus = useContext(AiTabFocusContext)
  if (!tabsList || !tabFocus) {
    throw new Error('useAiTabsSliceState must be used within AiProvider')
  }
  return useMemo(() => ({ ...tabsList, ...tabFocus }), [tabsList, tabFocus])
}

export const useAiRegistryMeta = (): AiRegistryMetaSliceState => {
  const context = useContext(AiRegistryMetaSliceContext)
  if (!context) {
    throw new Error('useAiRegistryMeta must be used within AiProvider')
  }
  return context
}

export const useAiModelsCatalog = (): AiModelsCatalogSliceState => {
  const context = useContext(AiModelsCatalogSliceContext)
  if (!context) {
    throw new Error('useAiModelsCatalog must be used within AiProvider')
  }
  return context
}

export const useAiCatalogState = (): AiCatalogSliceState => {
  const registryMeta = useContext(AiRegistryMetaSliceContext)
  const modelsCatalog = useContext(AiModelsCatalogSliceContext)
  if (!registryMeta || !modelsCatalog) {
    throw new Error('useAiCatalogState must be used within AiProvider')
  }
  return useMemo(() => ({ ...registryMeta, ...modelsCatalog }), [registryMeta, modelsCatalog])
}

export const useAiSessionUiPrefsState = (): AiSessionUiPrefsSliceState => {
  const context = useContext(AiSessionUiPrefsSliceContext)
  if (!context) {
    throw new Error('useAiSessionUiPrefsState must be used within AiProvider')
  }
  return context
}

export const useAiRegistryPrefsState = (): AiRegistryPrefsSliceState => {
  const registryMeta = useContext(AiRegistryMetaSliceContext)
  const modelsCatalog = useContext(AiModelsCatalogSliceContext)
  const sessionPrefsSlice = useContext(AiSessionUiPrefsSliceContext)
  if (!registryMeta || !modelsCatalog || !sessionPrefsSlice) {
    throw new Error('useAiRegistryPrefsState must be used within AiProvider')
  }
  return useMemo(
    () => ({ ...registryMeta, ...modelsCatalog, ...sessionPrefsSlice }),
    [registryMeta, modelsCatalog, sessionPrefsSlice]
  )
}

export const useAiCoreWorkspaceActions = (): AiCoreWorkspaceActions => {
  const context = useContext(AiCoreWorkspaceActionsContext)
  if (!context) {
    throw new Error('useAiCoreWorkspaceActions must be used within AiProvider')
  }
  return context
}

export const useAiWebviewHostActions = (): AiWebviewHostActions => {
  const context = useContext(AiWebviewHostActionsContext)
  if (!context) {
    throw new Error('useAiWebviewHostActions must be used within AiProvider')
  }
  return context
}

export const useAiWorkspaceActions = () => {
  const core = useContext(AiCoreWorkspaceActionsContext)
  const host = useContext(AiWebviewHostActionsContext)
  if (!core || !host) {
    throw new Error('useAiWorkspaceActions must be used within AiProvider')
  }
  return useMemo(() => ({ ...core, ...host }), [core, host])
}

export const useAiMessagingActions = (): AiMessagingActions => {
  const context = useContext(AiMessagingActionsContext)
  if (!context) {
    throw new Error('useAiMessagingActions must be used within AiProvider')
  }
  return context
}

export const useAiActions = (): AiContextActions => {
  const core = useContext(AiCoreWorkspaceActionsContext)
  const host = useContext(AiWebviewHostActionsContext)
  const messaging = useContext(AiMessagingActionsContext)
  if (!core || !host || !messaging) {
    throw new Error('useAiActions must be used within AiProvider')
  }
  return useMemo(() => ({ ...core, ...host, ...messaging }), [core, host, messaging])
}

export const useAiWebview = () => {
  const context = useContext(AiWebviewContext)
  if (!context) throw new Error('useAiWebview must be used within AiProvider')
  return context
}

export const useAiWebviewPresence = (): AiWebviewPresenceState => {
  const context = useContext(AiWebviewPresenceContext)
  if (!context) {
    throw new Error('useAiWebviewPresence must be used within AiProvider')
  }
  return context
}

export const useAi = (): AiContextType => {
  const state = useAiState()
  const webview = useAiWebview()
  const actions = useAiActions()

  return useMemo(
    () => ({
      ...state,
      ...webview,
      ...actions
    }),
    [state, webview, actions]
  )
}
