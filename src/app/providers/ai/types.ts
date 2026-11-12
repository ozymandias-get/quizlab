import type { AiPlatform, SelectionPosition } from '@shared-core/types'
import type { AiContentController } from '@shared-core/types/aiContent'

import type { AiSendOptions, AiSendResult } from '@features/ai'

import type { Dispatch, SetStateAction } from 'react'

export type { AiSendResult }

// Tek kaynak: seçim konum tipi katmanlar arası bir sözleşmedir ve
// @shared-core/types altında yaşar (bkz. shared/types/pdf.ts).
export type { SelectionPosition }

/**
 * Gönderici bir sonuç döndürmediğinde kullanılan yedek sonuç.
 *
 * `sendTextToAI` / `sendImageToAI` / `sendBulkToAI` normalde her zaman bir
 * sonuç döndürür; bu yedek yalnızca sözleşmenin ihlal edildiği (istisna
 * yutulmuş bir katman, kırık bir mock) durumda devreye girer.
 *
 * Aşama **`uncertain`** seçilir çünkü elimizde **hiçbir bilgi** yoktur:
 * pipeline gerçekten hiçbir şey yapmamış olabilir, hedefe yarım bir içerik
 * bırakmış olabilir. Aşamasız bir iptal `resolveSendOutcome` tarafından zaten
 * belirsiz sayılır; burada bunu açıkça yazmak, aynı kararın iki yerde ve
 * farklı gerekçeyle alınmasını engeller.
 *
 * Güvenli olan taraf seçilmiştir: bu sonuç otomatik tekrarı kapatır, yani en
 * kötü ihtimalde kullanıcı elle devam eder; tersi seçilseydi en kötü ihtimalde
 * hedefte mükerrer mesaj oluşurdu.
 */
export const NO_SEND_RESULT: AiSendResult = {
  success: false,
  error: 'cancelled',
  stage: 'uncertain'
}

import type { PdfSourceMeta } from './pdfSource'

/**
 * One persisted tab row.
 *
 * The storage key predates the removal of pinning (`pinnedAiTabs`); it now
 * holds every open tab in order so a drag-reordered strip survives a restart.
 */
export interface StoredAiTab {
  id: string
  modelId: string
}

export interface Tab {
  id: string
  modelId: string
}

interface AiDraftTextItem {
  id: string
  type: 'text'
  text: string
  position?: SelectionPosition | null
  /** Seçim anındaki gerçek PDF kökeni (sayfa/toplam/belge). */
  source?: PdfSourceMeta | null
  createdAt?: number
}

export interface AiDraftImageItem {
  id: string
  type: 'image'
  dataUrl?: string
  /** Lightweight blob URL for preview; prefer over dataUrl for rendering. */
  blobUrl?: string
  page?: number
  captureKind?: 'full-page' | 'selection'
  /** Yeni kaynak modeli (sayfa/toplam/belge). Eski alanlarla geriye uyumlu. */
  source?: PdfSourceMeta | null
  createdAt?: number
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
  favoriteModels: string[]
  defaultAiModel: string
  aiSites: Record<string, AiPlatform>
  autoSend: boolean
}

/** Yalnızca sekme listesi (aktif sekme değişince referans genelde aynı kalır). */
export type AiTabsListSliceState = Pick<AiContextState, 'tabs'>

/** Aktif sekme ve seçili model (liste uzunluğu değişmeden güncellenebilir). */
export type AiTabFocusSliceState = Pick<AiContextState, 'activeTabId' | 'currentAI'>

/** Sadece AiViewSurface'in abone olduğu nonce — bu değer değiştiğinde tüm sekme tüketicilerinin
 *  gereksiz yere yeniden render olmasını önler. openAiWorkspace her çağrıldığında artar. */
export type AiViewRequestNonceState = Pick<AiContextState, 'aiViewRequestNonce'>

/** Birleşik sekme dilimi (`useAiTabsList` / `useAiTabFocus` ile daha dar abonelik mümkün). */
export type AiTabsSliceState = AiTabsListSliceState & AiTabFocusSliceState

/** Yükleme + UA — model/site listesinden ayrı; PDF viewer yalnızca buna abone olabilir. */
export type AiRegistryMetaSliceState = Pick<AiContextState, 'isRegistryLoaded' | 'chromeUserAgent'>

/** Siteler + etkin modeller — UA değişmeden güncellenebilir. */
export type AiModelsCatalogSliceState = Pick<
  AiContextState,
  'enabledModels' | 'favoriteModels' | 'defaultAiModel' | 'aiSites'
>

/** Gönderim gibi hızlı UI tercihleri (katalogdan ayrı abonelik). */
export type AiSessionUiPrefsSliceState = Pick<AiContextState, 'autoSend'>

export interface AiContentState {
  getContentController: (tabId?: string) => AiContentController | null
}

/** Aktif sekmede content var mı (referans değişiminden bağımsız; şerit yenile butonu için). */
export interface AiContentPresenceState {
  hasActiveContent: boolean
}

interface AiContextActions {
  addTab: (modelId: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  openAiWorkspace: (modelId: string) => void
  moveTab: (tabId: string, targetId: string, placeAfter: boolean) => void
  setEnabledModels: (models: string[]) => void
  setFavoriteModels: (models: string[]) => void
  toggleFavoriteModel: (model: string) => void
  setDefaultAiModel: (model: string) => void
  setAutoSend: (value: boolean) => void
  toggleAutoSend: () => void
  registerContent: (
    id: string,
    instance: AiContentController | null,
    expectedInstance?: AiContentController
  ) => void
  /** Aktif sekmedeki AI web görünümünü yeniden yükler (Electron content.reload). */
  reloadActiveContent: () => void
  sendTextToAI: (text: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendImageToAI: (imageData: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendBulkToAI?: (imageDataUrls: string[], options?: AiSendOptions) => Promise<AiSendResult>
  cancelOngoing: () => void
}

/** Content tabanlı gönderim; aktif sekme değişince güncellenir (dar abonelik: useAiMessagingActions). */
export type AiMessagingActions = Pick<
  AiContextActions,
  'sendTextToAI' | 'sendImageToAI' | 'sendBulkToAI' | 'cancelOngoing'
>

/** Sekme, model ve content kayıt aksiyonları (gönderimden bağımsız). */
type AiWorkspaceActions = Omit<AiContextActions, 'sendTextToAI' | 'sendImageToAI' | 'sendBulkToAI'>

/** Content örneğine bağlı kayıt / yenileme (dar abonelik: useAiContentHostActions). */
export type AiContentHostActions = Pick<
  AiWorkspaceActions,
  'registerContent' | 'reloadActiveContent'
>

export type AiTabActions = Pick<
  AiContextActions,
  'addTab' | 'closeTab' | 'setActiveTab' | 'openAiWorkspace' | 'moveTab'
>

export type AiModelActions = Pick<
  AiContextActions,
  'setEnabledModels' | 'setDefaultAiModel' | 'setFavoriteModels' | 'toggleFavoriteModel'
>

export type AiSessionActions = Pick<AiContextActions, 'setAutoSend' | 'toggleAutoSend'>

export type SetStoredValue<T> = Dispatch<SetStateAction<T>>
