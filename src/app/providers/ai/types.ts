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

export interface AiWebviewState {
  webviewInstance: WebviewController | null
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

export type AiContextType = AiContextState & AiWebviewState & AiContextActions
export type SetStoredValue<T> = Dispatch<SetStateAction<T>>
