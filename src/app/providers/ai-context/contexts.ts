import { createContext } from 'react'
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

export const AiTabsListContext = createContext<AiTabsListSliceState | null>(null)
export const AiTabFocusContext = createContext<AiTabFocusSliceState | null>(null)
export const AiRegistryMetaSliceContext = createContext<AiRegistryMetaSliceState | null>(null)
export const AiModelsCatalogSliceContext = createContext<AiModelsCatalogSliceState | null>(null)
export const AiSessionUiPrefsSliceContext = createContext<AiSessionUiPrefsSliceState | null>(null)
export const AiCoreWorkspaceActionsContext = createContext<AiCoreWorkspaceActions | null>(null)
export const AiWebviewHostActionsContext = createContext<AiWebviewHostActions | null>(null)
export const AiMessagingActionsContext = createContext<AiMessagingActions | null>(null)
export const AiWebviewContext = createContext<AiWebviewState | null>(null)
export const AiWebviewPresenceContext = createContext<AiWebviewPresenceState | null>(null)
