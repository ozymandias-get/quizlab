import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import type { AiSendOptions, AiSendResult } from '@features/ai'

import type { Dispatch, SetStateAction } from 'react'

export type { AiSendResult }

export interface PinnedTabStorage {
  id: string
  modelId: string
  title?: string
}

export interface Tab {
  id: string
  modelId: string
  title?: string
  pinned?: boolean
}

export interface SelectionPosition {
  top: number
  left: number
  width?: number
  height?: number
}

interface AiDraftTextItem {
  id: string
  type: 'text'
  text: string
  position?: SelectionPosition | null
}

export interface AiDraftImageItem {
  id: string
  type: 'image'
  dataUrl?: string
  /** Lightweight blob URL for preview; prefer over dataUrl for rendering. */
  blobUrl?: string
  page?: number
  captureKind?: 'full-page' | 'selection'
}

export type AiDraftItem = AiDraftTextItem | AiDraftImageItem

interface AiContextState {
  isRegistryLoaded: boolean
  chromeUserAgent: string
  tabs: Tab[]
  activeTabId: string
  aiViewRequestNonce: number
  currentAI: string
  enabledModels: string[]
  defaultAiModel: string
  aiSites: Record<string, AiPlatform>
  autoSend: boolean
  isTutorialActive: boolean
}

/** YalnÄ±zca sekme listesi (aktif sekme deÄŸiÅŸince referans genelde aynÄ± kalÄ±r). */
export type AiTabsListSliceState = Pick<AiContextState, 'tabs'>

/** Aktif sekme ve seÃ§ili model (liste uzunluÄŸu deÄŸiÅŸmeden gÃ¼ncellenebilir). */
export type AiTabFocusSliceState = Pick<AiContextState, 'activeTabId' | 'currentAI'>

/** Sadece AiWebview'in abone olduÄŸu nonce â€” bu deÄŸer deÄŸiÅŸtiÄŸinde tÃ¼m sekme tÃ¼keticilerinin
 *  gereksiz yere yeniden render olmasÄ±nÄ± Ã¶nler. openAiWorkspace her Ã§aÄŸrÄ±ldÄ±ÄŸÄ±nda artar. */
export type AiViewRequestNonceState = Pick<AiContextState, 'aiViewRequestNonce'>

/** BirleÅŸik sekme dilimi (`useAiTabsList` / `useAiTabFocus` ile daha dar abonelik mÃ¼mkÃ¼n). */
export type AiTabsSliceState = AiTabsListSliceState & AiTabFocusSliceState

/** YÃ¼kleme + UA â€” model/site listesinden ayrÄ±; PDF viewer yalnÄ±zca buna abone olabilir. */
export type AiRegistryMetaSliceState = Pick<AiContextState, 'isRegistryLoaded' | 'chromeUserAgent'>

/** Siteler + etkin modeller â€” UA deÄŸiÅŸmeden gÃ¼ncellenebilir. */
export type AiModelsCatalogSliceState = Pick<
  AiContextState,
  'enabledModels' | 'defaultAiModel' | 'aiSites'
>

/** GÃ¶nderim / tutorial gibi hÄ±zlÄ± UI tercihleri (katalogdan ayrÄ± abonelik). */
export type AiSessionUiPrefsSliceState = Pick<AiContextState, 'autoSend' | 'isTutorialActive'>

export interface AiWebviewState {
  getWebviewInstance: (tabId?: string) => WebviewController | null
}

/** Aktif sekmede webview var mÄ± (referans deÄŸiÅŸiminden baÄŸÄ±msÄ±z; ÅŸerit yenile butonu iÃ§in). */
export interface AiWebviewPresenceState {
  hasActiveWebview: boolean
}

interface AiContextActions {
  addTab: (modelId: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  openAiWorkspace: (modelId: string) => void
  renameTab: (tabId: string, title?: string) => void
  togglePinTab: (tabId: string) => void
  setCurrentAI: (id: string) => void
  setEnabledModels: (models: string[]) => void
  setDefaultAiModel: (model: string) => void
  setAutoSend: (value: boolean) => void
  toggleAutoSend: () => void
  registerWebview: (
    id: string,
    instance: WebviewController | null,
    expectedInstance?: WebviewController
  ) => void
  /** Aktif sekmedeki AI web gÃ¶rÃ¼nÃ¼mÃ¼nÃ¼ yeniden yÃ¼kler (Electron webview.reload). */
  reloadActiveWebview: () => void
  sendTextToAI: (text: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendImageToAI: (imageData: string, options?: AiSendOptions) => Promise<AiSendResult>
  cancelOngoing: () => void
  startTutorial: () => void
  stopTutorial: () => void
}

/** Webview tabanlÄ± gÃ¶nderim; aktif sekme deÄŸiÅŸince gÃ¼ncellenir (dar abonelik: useAiMessagingActions). */
export type AiMessagingActions = Pick<
  AiContextActions,
  'sendTextToAI' | 'sendImageToAI' | 'cancelOngoing'
>

/** Sekme, model ve webview kayÄ±t aksiyonlarÄ± (gÃ¶nderimden baÄŸÄ±msÄ±z). */
type AiWorkspaceActions = Omit<AiContextActions, 'sendTextToAI' | 'sendImageToAI'>

/** Webview Ã¶rneÄŸine baÄŸlÄ± kayÄ±t / yenileme (dar abonelik: useAiWebviewHostActions). */
export type AiWebviewHostActions = Pick<
  AiWorkspaceActions,
  'registerWebview' | 'reloadActiveWebview'
>

/** Sekme ve modeller; aktif webview deÄŸiÅŸince gÃ¼ncellenmez. */
export type AiCoreWorkspaceActions = Omit<
  AiWorkspaceActions,
  'registerWebview' | 'reloadActiveWebview' | 'cancelOngoing'
>

export type AiTabActions = Pick<
  AiContextActions,
  'addTab' | 'closeTab' | 'setActiveTab' | 'openAiWorkspace' | 'renameTab' | 'togglePinTab'
>

export type AiModelActions = Pick<
  AiContextActions,
  'setCurrentAI' | 'setEnabledModels' | 'setDefaultAiModel'
>

export type AiSessionActions = Pick<
  AiContextActions,
  'setAutoSend' | 'toggleAutoSend' | 'startTutorial' | 'stopTutorial'
>

export type AiContextType = AiContextState & AiWebviewState & AiContextActions
export type SetStoredValue<T> = Dispatch<SetStateAction<T>>
