import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

import type { AiSendOptions, AiSendResult } from '@features/ai/model/types'

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

interface AiDraftTextItem {
  id: string
  type: 'text'
  text: string
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

/** Yalnızca sekme listesi (aktif sekme değişince referans genelde aynı kalır). */
export type AiTabsListSliceState = Pick<AiContextState, 'tabs'>

/** Aktif sekme ve seçili model (liste uzunluğu değişmeden güncellenebilir). */
export type AiTabFocusSliceState = Pick<AiContextState, 'activeTabId' | 'currentAI'>

/** Sadece AiWebview'in abone olduğu nonce — bu değer değiştiğinde tüm sekme tüketicilerinin
 *  gereksiz yere yeniden render olmasını önler. openAiWorkspace her çağrıldığında artar. */
export type AiViewRequestNonceState = Pick<AiContextState, 'aiViewRequestNonce'>

/** Birleşik sekme dilimi (`useAiTabsList` / `useAiTabFocus` ile daha dar abonelik mümkün). */
export type AiTabsSliceState = AiTabsListSliceState & AiTabFocusSliceState

/** Yükleme + UA — model/site listesinden ayrı; PDF viewer yalnızca buna abone olabilir. */
export type AiRegistryMetaSliceState = Pick<AiContextState, 'isRegistryLoaded' | 'chromeUserAgent'>

/** Siteler + etkin modeller — UA değişmeden güncellenebilir. */
export type AiModelsCatalogSliceState = Pick<
  AiContextState,
  'enabledModels' | 'defaultAiModel' | 'aiSites'
>

/** Gönderim / tutorial gibi hızlı UI tercihleri (katalogdan ayrı abonelik). */
export type AiSessionUiPrefsSliceState = Pick<AiContextState, 'autoSend' | 'isTutorialActive'>

export interface AiWebviewState {
  getWebviewInstance: (tabId?: string) => WebviewController | null
}

/** Aktif sekmede webview var mı (referans değişiminden bağımsız; şerit yenile butonu için). */
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
  registerWebview: (id: string, instance: WebviewController | null) => void
  /** Aktif sekmedeki AI web görünümünü yeniden yükler (Electron webview.reload). */
  reloadActiveWebview: () => void
  sendTextToAI: (text: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendImageToAI: (imageData: string, options?: AiSendOptions) => Promise<AiSendResult>
  cancelOngoing: () => void
  startTutorial: () => void
  stopTutorial: () => void
}

/** Webview tabanlı gönderim; aktif sekme değişince güncellenir (dar abonelik: useAiMessagingActions). */
export type AiMessagingActions = Pick<
  AiContextActions,
  'sendTextToAI' | 'sendImageToAI' | 'cancelOngoing'
>

/** Sekme, model ve webview kayıt aksiyonları (gönderimden bağımsız). */
type AiWorkspaceActions = Omit<AiContextActions, 'sendTextToAI' | 'sendImageToAI'>

/** Webview örneğine bağlı kayıt / yenileme (dar abonelik: useAiWebviewHostActions). */
export type AiWebviewHostActions = Pick<
  AiWorkspaceActions,
  'registerWebview' | 'reloadActiveWebview'
>

/** Sekme ve modeller; aktif webview değişince güncellenmez. */
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
