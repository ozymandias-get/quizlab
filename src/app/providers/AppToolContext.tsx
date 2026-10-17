import type { AiSendOptions } from '@features/ai'

import { useToastActions } from '@shared/stores/toastStore'

import { createContext, type ReactNode, useContext, useMemo } from 'react'

import type { PdfSourceMeta } from './ai/pdfSource'
import type { AiDraftItem, AiSendResult, SelectionPosition } from './ai/types'
import {
  useAiContent,
  useAiMessagingActions,
  useAiSessionActions,
  useAiSessionUiPrefsState,
  useAiTabFocus
} from './ai-context'
import {
  type QueuedImageMeta,
  type QueuedTextMeta,
  useAiDraftQueue
} from './app-tool/useAiDraftQueue'
import { useDraftSendOrchestration } from './app-tool/useDraftSendOrchestration'
import { useElementPickerLifecycle } from './app-tool/useElementPickerLifecycle'
import { useGeminiSessionRefreshListeners } from './app-tool/useGeminiSessionRefreshListeners'
import type {
  PendingAreaCapture,
  PendingFullPageCapture,
  PendingFullPageTextCapture
} from './app-tool/useScreenshotPipeline'
import { useScreenshotPipeline } from './app-tool/useScreenshotPipeline'

interface AppToolQueueState {
  pendingAiItems: AiDraftItem[]
  autoSend: boolean
}

interface AppToolScreenshotState {
  isScreenshotMode: boolean
  pendingAreaCapture: PendingAreaCapture | null
  pendingFullPageCapture: PendingFullPageCapture | null
  /**
   * Tam sayfa metni için bekleyen karar. Görsellerin aynı sözleşmesini paylaşır:
   * metin kuyruğa doğrudan yazılmaz, ikili menüde karar verilir.
   */
  pendingFullPageTextCapture: PendingFullPageTextCapture | null
}

interface AppToolPickerState {
  isPickerActive: boolean
}

interface AppToolActionsType {
  startScreenshot: (imageMeta?: QueuedImageMeta) => void
  closeScreenshot: () => void
  handleCapture: (
    dataUrl: string,
    rect?: { left: number; top: number; width: number; height: number }
  ) => Promise<void>
  /**
   * Bekleyen yakalamayı taslağa taşır; **yalnızca kuyruk kabul ederse** `true`.
   * `false` dönerse yakalama hâlâ bekler ve kaynağı korunur — çağıran bu sonucu
   * kontrol etmezse reddedilen bir eklemeyi "başarılı" bildirir.
   */
  confirmPendingAreaAsDraft: () => boolean
  dismissPendingArea: () => void
  /**
   * Yakalamanın kaynağı, üzerinde süren bir gönderim olduğunu bildirir.
   *
   * Kaynak bu andan itibaren **gönderimin sorumluluğundadır**: yeni bir
   * yakalama eski bekleyeni düşürse bile kaynak iptal edilmez, işlem bitince
   * `releaseCaptureSource` ile geri alınır. Çağıran eşleştirmek üzere
   * yakalamanın `id` değerini saklamak zorundadır.
   */
  retainCaptureSource: (id: string) => void
  /** Süren gönderim bitti: ertelenen kaynak iptali (varsa) burada yapılır. */
  releaseCaptureSource: (id: string) => void
  /** Tam sayfa yakalaması menü kararına açılır (doğrudan kuyruğa yazılmaz). */
  offerFullPageCapture: (imageUri: string, meta?: QueuedImageMeta | null) => void
  /** Alan yakalamasıyla aynı sözleşme: kabul `true`, ret `false`. */
  confirmPendingFullPageAsDraft: () => boolean
  dismissPendingFullPage: () => void
  /**
   * Tam sayfa metni menü kararına açılır (doğrudan kuyruğa yazılmaz).
   *
   * Görsel yollarla aynı sözleşme: "Bu Sayfanın Metnini AI'ye Ekle" artık
   * doğrudan `queueTextForAi` çağırmaz, ikili menüyü açar.
   */
  offerFullPageText: (text: string, meta?: QueuedTextMeta | null) => void
  confirmPendingFullPageTextAsDraft: () => boolean
  dismissPendingFullPageText: () => void
  /**
   * Kuyruğa ekleme **gerçek boolean sonucunu** döndürür: kabul `true`, ret
   * `false`. `void` bir sözleşme, alt katmanın reddettiği bir eklemeyi tüketiciye
   * "başarılı" taşır; kullanıcıya eklenmemiş bir içerik "eklendi" diye
   * gösterilir. Bu yüzden tip bilinçli olarak boolean'dır.
   */
  queueTextForAi: (
    text: string,
    position?: SelectionPosition | null,
    meta?: { source?: PdfSourceMeta | null } | PdfSourceMeta | null
  ) => boolean
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => boolean
  removePendingAiItem: (id: string) => void
  clearPendingAiItems: () => void
  sendPendingAiItems: (options?: AiSendOptions) => Promise<AiSendResult>
  /** Doğrudan gönderim: taslak kuyruğuna dokunmadan mevcut AI pipeline'ına iletir. */
  sendTextDirectToAi: (text: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendImageDirectToAi: (dataUrl: string, options?: AiSendOptions) => Promise<AiSendResult>
  sendBulkDirectToAi?: (imageDataUrls: string[], options?: AiSendOptions) => Promise<AiSendResult>
  setAutoSend: (value: boolean) => void
  toggleAutoSend: () => void
  startPicker: () => void
  startPickerWhenReady: () => void
  togglePicker: () => void
}

/**
 * One context per concern, so a consumer only re-renders for the slice it reads.
 * There is deliberately no combined "give me everything" hook: it produced a new
 * object on every flag change, which re-rendered consumers for state they never
 * used. Compose the hooks you need instead.
 */
const AppToolQueueContext = createContext<AppToolQueueState | null>(null)
const AppToolScreenshotContext = createContext<AppToolScreenshotState | null>(null)
const AppToolPickerContext = createContext<AppToolPickerState | null>(null)
const AppToolActionsContext = createContext<AppToolActionsType | null>(null)

function AppToolProvider({ children }: { children: ReactNode }) {
  const { sendTextToAI, sendImageToAI, sendBulkToAI, cancelOngoing } = useAiMessagingActions()
  const { setAutoSend, toggleAutoSend } = useAiSessionActions()
  const { autoSend } = useAiSessionUiPrefsState()
  const { currentAI } = useAiTabFocus()
  const { showError } = useToastActions()
  const { getContentController } = useAiContent()

  const {
    pendingAiItems,
    pendingAiItemsRef,
    setPendingAiItems,
    queueTextForAi,
    queueImageForAi,
    removePendingAiItem,
    clearPendingAiItems: clearPendingAiItemsRaw
  } = useAiDraftQueue(() => showError('draft_queue_full'))
  const {
    isScreenshotMode,
    pendingAreaCapture,
    pendingFullPageCapture,
    startScreenshot,
    closeScreenshot,
    handleCapture,
    confirmPendingAreaAsDraft,
    dismissPendingArea,
    retainCaptureSource,
    releaseCaptureSource,
    offerFullPageCapture,
    confirmPendingFullPageAsDraft,
    dismissPendingFullPage,
    pendingFullPageTextCapture,
    offerFullPageText,
    confirmPendingFullPageTextAsDraft,
    dismissPendingFullPageText,
    clearScreenshotMeta
  } = useScreenshotPipeline({ queueImageForAi, queueTextForAi })

  const clearPendingAiItems = useMemo(() => {
    return () => {
      cancelOngoing()
      clearScreenshotMeta()
      clearPendingAiItemsRaw()
    }
  }, [cancelOngoing, clearScreenshotMeta, clearPendingAiItemsRaw])

  const { sendPendingAiItems } = useDraftSendOrchestration({
    autoSend,
    providerId: currentAI,
    sendTextToAI,
    sendBulkToAI,
    pendingAiItemsRef,
    setPendingAiItems
  })

  const { isPickerActive, startPicker, startPickerWhenReady, togglePicker } =
    useElementPickerLifecycle(getContentController)

  useGeminiSessionRefreshListeners({ showError })

  const queueValue = useMemo<AppToolQueueState>(
    () => ({ pendingAiItems, autoSend }),
    [pendingAiItems, autoSend]
  )

  const screenshotValue = useMemo<AppToolScreenshotState>(
    () => ({
      isScreenshotMode,
      pendingAreaCapture,
      pendingFullPageCapture,
      pendingFullPageTextCapture
    }),
    [isScreenshotMode, pendingAreaCapture, pendingFullPageCapture, pendingFullPageTextCapture]
  )

  const pickerValue = useMemo<AppToolPickerState>(() => ({ isPickerActive }), [isPickerActive])

  const actionsValue = useMemo<AppToolActionsType>(
    () => ({
      startScreenshot,
      closeScreenshot,
      handleCapture,
      confirmPendingAreaAsDraft,
      dismissPendingArea,
      retainCaptureSource,
      releaseCaptureSource,
      offerFullPageCapture,
      confirmPendingFullPageAsDraft,
      dismissPendingFullPage,
      offerFullPageText,
      confirmPendingFullPageTextAsDraft,
      dismissPendingFullPageText,
      queueTextForAi,
      queueImageForAi,
      removePendingAiItem,
      clearPendingAiItems,
      sendPendingAiItems,
      sendTextDirectToAi: sendTextToAI,
      sendImageDirectToAi: sendImageToAI,
      sendBulkDirectToAi: sendBulkToAI,
      setAutoSend,
      toggleAutoSend,
      startPicker,
      startPickerWhenReady,
      togglePicker
    }),
    [
      startScreenshot,
      closeScreenshot,
      handleCapture,
      confirmPendingAreaAsDraft,
      dismissPendingArea,
      retainCaptureSource,
      releaseCaptureSource,
      offerFullPageCapture,
      confirmPendingFullPageAsDraft,
      dismissPendingFullPage,
      offerFullPageText,
      confirmPendingFullPageTextAsDraft,
      dismissPendingFullPageText,
      queueTextForAi,
      queueImageForAi,
      removePendingAiItem,
      clearPendingAiItems,
      sendPendingAiItems,
      sendTextToAI,
      sendImageToAI,
      sendBulkToAI,
      setAutoSend,
      toggleAutoSend,
      startPicker,
      startPickerWhenReady,
      togglePicker
    ]
  )

  return (
    <AppToolQueueContext.Provider value={queueValue}>
      <AppToolScreenshotContext.Provider value={screenshotValue}>
        <AppToolPickerContext.Provider value={pickerValue}>
          <AppToolActionsContext.Provider value={actionsValue}>
            {children}
          </AppToolActionsContext.Provider>
        </AppToolPickerContext.Provider>
      </AppToolScreenshotContext.Provider>
    </AppToolQueueContext.Provider>
  )
}

export default AppToolProvider

export const useAppToolQueueState = () => {
  const context = useContext(AppToolQueueContext)
  if (!context) throw new Error('useAppToolQueueState must be used within AppToolProvider')
  return context
}

export const useAppToolScreenshotState = () => {
  const context = useContext(AppToolScreenshotContext)
  if (!context) throw new Error('useAppToolScreenshotState must be used within AppToolProvider')
  return context
}

export const useAppToolPickerState = () => {
  const context = useContext(AppToolPickerContext)
  if (!context) throw new Error('useAppToolPickerState must be used within AppToolProvider')
  return context
}

export const useAppToolActions = () => {
  const context = useContext(AppToolActionsContext)
  if (!context) throw new Error('useAppToolActions must be used within AppToolProvider')
  return context
}
