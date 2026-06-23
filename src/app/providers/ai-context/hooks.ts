import type { AiPlatform } from '@shared-core/types'

import { useContext, useMemo } from 'react'

import type {
  AiContextType,
  AiMessagingActions,
  AiModelActions,
  AiModelsCatalogSliceState,
  AiRegistryMetaSliceState,
  AiSessionActions,
  AiSessionUiPrefsSliceState,
  AiTabActions,
  AiTabFocusSliceState,
  AiTabsListSliceState,
  AiTabsSliceState,
  AiWebviewHostActions,
  AiWebviewPresenceState
} from '../ai/types'
import {
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

export const useAiTabsList = (): AiTabsListSliceState => {
  const context = useContext(AiTabsListContext)
  if (!context) {
    throw new Error('useAiTabsList must be used within AiProvider')
  }
  return context
}

export const useAiSites = (): Record<string, AiPlatform> => {
  const context = useContext(AiSitesContext)
  if (!context) {
    throw new Error('useAiSites must be used within AiProvider')
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

/** Yalnızca `aiViewRequestNonce` değerine abone olur — `AiWebview` dışında
 *  kullanıldığında bu değerin değişmesi diğer bileşenleri gereksiz yere
 *  render etmez çünkü artık `AiTabFocusContext`'ten ayrılmıştır. */
export const useAiViewRequestNonce = (): number => {
  const context = useContext(AiViewRequestNonceContext)
  if (!context) {
    throw new Error('useAiViewRequestNonce must be used within AiProvider')
  }
  return context.aiViewRequestNonce
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

export const useAiSessionUiPrefsState = (): AiSessionUiPrefsSliceState => {
  const context = useContext(AiSessionUiPrefsSliceContext)
  if (!context) {
    throw new Error('useAiSessionUiPrefsState must be used within AiProvider')
  }
  return context
}

export const useAiTabActions = (): AiTabActions => {
  const context = useContext(AiTabActionsContext)
  if (!context) {
    throw new Error('useAiTabActions must be used within AiProvider')
  }
  return context
}

export const useAiModelActions = (): AiModelActions => {
  const context = useContext(AiModelActionsContext)
  if (!context) {
    throw new Error('useAiModelActions must be used within AiProvider')
  }
  return context
}

export const useAiSessionActions = (): AiSessionActions => {
  const context = useContext(AiSessionActionsContext)
  if (!context) {
    throw new Error('useAiSessionActions must be used within AiProvider')
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

export const useAiMessagingActions = (): AiMessagingActions => {
  const context = useContext(AiMessagingActionsContext)
  if (!context) {
    throw new Error('useAiMessagingActions must be used within AiProvider')
  }
  return context
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
  const tabsList = useContext(AiTabsListContext)
  const tabFocus = useContext(AiTabFocusContext)
  const viewRequestNonce = useContext(AiViewRequestNonceContext)
  const registryMeta = useContext(AiRegistryMetaSliceContext)
  const modelsCatalog = useContext(AiModelsCatalogSliceContext)
  const sessionPrefsSlice = useContext(AiSessionUiPrefsSliceContext)
  const webview = useContext(AiWebviewContext)
  const tab = useContext(AiTabActionsContext)
  const model = useContext(AiModelActionsContext)
  const session = useContext(AiSessionActionsContext)
  const host = useContext(AiWebviewHostActionsContext)
  const messaging = useContext(AiMessagingActionsContext)
  if (
    !tabsList ||
    !tabFocus ||
    !viewRequestNonce ||
    !registryMeta ||
    !modelsCatalog ||
    !sessionPrefsSlice ||
    !webview ||
    !tab ||
    !model ||
    !session ||
    !host ||
    !messaging
  ) {
    throw new Error('useAi must be used within AiProvider')
  }
  return useMemo(
    () => ({
      ...tabsList,
      ...tabFocus,
      ...viewRequestNonce,
      ...registryMeta,
      ...modelsCatalog,
      ...sessionPrefsSlice,
      ...webview,
      ...tab,
      ...model,
      ...session,
      ...host,
      ...messaging
    }),
    [
      tabsList,
      tabFocus,
      viewRequestNonce,
      registryMeta,
      modelsCatalog,
      sessionPrefsSlice,
      webview,
      tab,
      model,
      session,
      host,
      messaging
    ]
  )
}
