import type { AiPlatform } from '@shared-core/types'

import { createContext } from 'react'

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

export const AiSitesContext = createContext<Record<string, AiPlatform> | null>(null)

export const AiTabsListContext = createContext<AiTabsListSliceState | null>(null)
export const AiTabFocusContext = createContext<AiTabFocusSliceState | null>(null)
/** Yalnızca `AiWebview` tarafından tüketilir — diğer bileşenlerin gereksiz render'ını önler. */
export const AiViewRequestNonceContext = createContext<AiViewRequestNonceState | null>(null)
export const AiRegistryMetaSliceContext = createContext<AiRegistryMetaSliceState | null>(null)
export const AiModelsCatalogSliceContext = createContext<AiModelsCatalogSliceState | null>(null)
export const AiSessionUiPrefsSliceContext = createContext<AiSessionUiPrefsSliceState | null>(null)
export const AiCoreWorkspaceActionsContext = createContext<AiCoreWorkspaceActions | null>(null)
export const AiWebviewHostActionsContext = createContext<AiWebviewHostActions | null>(null)
export const AiMessagingActionsContext = createContext<AiMessagingActions | null>(null)
export const AiWebviewContext = createContext<AiWebviewState | null>(null)
export const AiWebviewPresenceContext = createContext<AiWebviewPresenceState | null>(null)

export const AiTabActionsContext = createContext<AiTabActions | null>(null)
export const AiModelActionsContext = createContext<AiModelActions | null>(null)
export const AiSessionActionsContext = createContext<AiSessionActions | null>(null)
