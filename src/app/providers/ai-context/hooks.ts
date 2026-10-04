import type { AiPlatform } from '@shared-core/types'

import { useContext, useMemo } from 'react'

import type {
  AiContentHostActions,
  AiContentPresenceState,
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
  AiTabsSliceState
} from '../ai/types'
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

/** Yalnızca `aiViewRequestNonce` değerine abone olur — `AiViewSurface` dışında
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

export const useAiContentHostActions = (): AiContentHostActions => {
  const context = useContext(AiContentHostActionsContext)
  if (!context) {
    throw new Error('useAiContentHostActions must be used within AiProvider')
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

export const useAiContent = () => {
  const context = useContext(AiContentContext)
  if (!context) throw new Error('useAiContent must be used within AiProvider')
  return context
}

export const useAiContentPresence = (): AiContentPresenceState => {
  const context = useContext(AiContentPresenceContext)
  if (!context) {
    throw new Error('useAiContentPresence must be used within AiProvider')
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
  const content = useContext(AiContentContext)
  const tab = useContext(AiTabActionsContext)
  const model = useContext(AiModelActionsContext)
  const session = useContext(AiSessionActionsContext)
  const host = useContext(AiContentHostActionsContext)
  const messaging = useContext(AiMessagingActionsContext)
  if (
    !tabsList ||
    !tabFocus ||
    !viewRequestNonce ||
    !registryMeta ||
    !modelsCatalog ||
    !sessionPrefsSlice ||
    !content ||
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
      ...content,
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
      content,
      tab,
      model,
      session,
      host,
      messaging
    ]
  )
}
