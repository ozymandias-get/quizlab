import type { Dispatch, SetStateAction } from 'react'
import type { AiSendOptions, AiSendResult } from '@features/ai'
import type { AiPlatform } from '@shared-core/types'
import type { WebviewController } from '@shared-core/types/webview'

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

export interface AiDraftTextItem {
  id: string
  type: 'text'
  text: string
}

export interface AiDraftImageItem {
  id: string
  type: 'image'
  dataUrl: string
  /** Lightweight blob URL for preview; prefer over dataUrl for rendering. */
  blobUrl?: string
  page?: number
  captureKind?: 'full-page' | 'selection'
}

export type AiDraftItem = AiDraftTextItem | AiDraftImageItem

export interface AiContextState {
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

/** Aktif sekme, yenileme nonce, seçili model (liste uzunluğu değişmeden güncellenebilir). */
export type AiTabFocusSliceState = Pick<
  AiContextState,
  'activeTabId' | 'aiViewRequestNonce' | 'currentAI'
>

/** Birleşik sekme dilimi (`useAiTabsList` / `useAiTabFocus` ile daha dar abonelik mümkün). */
export type AiTabsSliceState = AiTabsListSliceState & AiTabFocusSliceState

/** Yükleme + UA — model/site listesinden ayrı; PDF viewer yalnızca buna abone olabilir. */
export type AiRegistryMetaSliceState = Pick<AiContextState, 'isRegistryLoaded' | 'chromeUserAgent'>

/** Siteler + etkin modeller — UA değişmeden güncellenebilir. */
export type AiModelsCatalogSliceState = Pick<
  AiContextState,
  'enabledModels' | 'defaultAiModel' | 'aiSites'
>

/** Tam katalog dilimi (dar abonelik için `useAiRegistryMeta` / `useAiModelsCatalog` tercih edin). */
export type AiCatalogSliceState = AiRegistryMetaSliceState & AiModelsCatalogSliceState

/** Gönderim / tutorial gibi hızlı UI tercihleri (katalogdan ayrı abonelik). */
export type AiSessionUiPrefsSliceState = Pick<AiContextState, 'autoSend' | 'isTutorialActive'>

/** Katalog + oturum tercihleri (tam registry prefs dilimi). */
export type AiRegistryPrefsSliceState = AiCatalogSliceState & AiSessionUiPrefsSliceState

export interface AiWebviewState {
  webviewInstance: WebviewController | null
}

/** Aktif sekmede webview var mı (referans değişiminden bağımsız; şerit yenile butonu için). */
export interface AiWebviewPresenceState {
  hasActiveWebview: boolean
}

export interface AiContextActions {
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
  startTutorial: () => void
  stopTutorial: () => void
}

/** Webview tabanlı gönderim; aktif sekme değişince güncellenir (dar abonelik: useAiMessagingActions). */
export type AiMessagingActions = Pick<AiContextActions, 'sendTextToAI' | 'sendImageToAI'>

/** Sekme, model ve webview kayıt aksiyonları (gönderimden bağımsız). */
export type AiWorkspaceActions = Omit<AiContextActions, 'sendTextToAI' | 'sendImageToAI'>

/** Webview örneğine bağlı kayıt / yenileme (dar abonelik: useAiWebviewHostActions). */
export type AiWebviewHostActions = Pick<
  AiWorkspaceActions,
  'registerWebview' | 'reloadActiveWebview'
>

/** Sekme ve modeller; aktif webview değişince güncellenmez. */
export type AiCoreWorkspaceActions = Omit<
  AiWorkspaceActions,
  'registerWebview' | 'reloadActiveWebview'
>

export type AiContextType = AiContextState & AiWebviewState & AiContextActions
export type SetStoredValue<T> = Dispatch<SetStateAction<T>>
