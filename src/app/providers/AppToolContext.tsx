import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { AiSendOptions } from '@features/ai'
import { useScreenshot } from '@features/screenshot/hooks/useScreenshot'
import { useAiActions, useAiState, useAiWebview } from './AiContext'
import { useElementPicker } from '@features/automation/hooks/useElementPicker'
import { useGeminiWebOpenLogin } from '@platform/electron/api/useGeminiWebSessionApi'
import type { GeminiWebSessionActionResult } from '@shared-core/types'
import { planBulkAiSend } from './ai/planBulkAiSend'
import type { AiDraftImageItem, AiDraftItem, AiSendResult } from './ai/types'

type QueuedImageMeta = Pick<AiDraftImageItem, 'page' | 'captureKind'>

interface AppToolStateType {
  pendingAiItems: AiDraftItem[]
  isScreenshotMode: boolean
  autoSend: boolean
  isPickerActive: boolean
  isGeminiWebLoginInProgress: boolean
}

interface AppToolActionsType {
  startScreenshot: (imageMeta?: QueuedImageMeta) => void
  closeScreenshot: () => void
  handleCapture: (dataUrl: string) => Promise<void>
  queueTextForAi: (text: string) => void
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => void
  removePendingAiItem: (id: string) => void
  clearPendingAiItems: () => void
  sendPendingAiItems: (options?: AiSendOptions) => Promise<AiSendResult>
  setAutoSend: (value: boolean) => void
  startPicker: () => void
  startPickerWhenReady: () => void
  togglePicker: () => void
  startGeminiWebLogin: () => Promise<GeminiWebSessionActionResult>
}

const AppToolStateContext = createContext<AppToolStateType | null>(null)
const AppToolActionsContext = createContext<AppToolActionsType | null>(null)

function buildPendingId(prefix: 'text' | 'image') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function clearBrowserTextSelection() {
  if (typeof window === 'undefined' || typeof window.getSelection !== 'function') {
    return
  }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return
  }

  selection.removeAllRanges()
}

export function AppToolProvider({ children }: { children: ReactNode }) {
  const { sendTextToAI, sendImageToAI, setAutoSend } = useAiActions()
  const { autoSend } = useAiState()
  const { webviewInstance } = useAiWebview()
  const [pendingAiItems, setPendingAiItems] = useState<AiDraftItem[]>([])
  const [pickerStartNonce, setPickerStartNonce] = useState(0)
  const pendingPickerStartRef = useRef(false)
  const screenshotMetaRef = useRef<QueuedImageMeta | null>(null)
  const pendingAiItemsRef = useRef(pendingAiItems)
  pendingAiItemsRef.current = pendingAiItems

  const executeDraftSend = useCallback(
    async (items: AiDraftItem[], options?: AiSendOptions): Promise<AiSendResult> => {
      if (items.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      const effectiveAutoSend =
        options?.forceAutoSend === true ? true : (options?.autoSend ?? autoSend)
      const segments = planBulkAiSend(items, options?.promptText)

      if (segments.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      let result: AiSendResult = { success: true }

      for (const segment of segments) {
        if (segment.kind === 'text') {
          result = await sendTextToAI(segment.payload, { autoSend: effectiveAutoSend })
        } else {
          result = await sendImageToAI(segment.dataUrl, {
            autoSend: effectiveAutoSend,
            promptText: segment.promptText
          })
        }

        if (!result.success) {
          return result
        }
      }

      return result
    },
    [autoSend, sendImageToAI, sendTextToAI]
  )

  const queueTextForAi = useCallback((text: string) => {
    const normalized = text.trim()
    if (!normalized) {
      return
    }

    const item: AiDraftItem = {
      id: buildPendingId('text'),
      type: 'text',
      text: normalized
    }

    setPendingAiItems((current) => [...current, item])
  }, [])

  const queueImageForAi = useCallback((dataUrl: string, imageMeta?: QueuedImageMeta) => {
    if (!dataUrl.startsWith('data:image/')) {
      return
    }

    let blobUrl: string | undefined
    try {
      const byteString = atob(dataUrl.split(',')[1])
      const mimeMatch = dataUrl.match(/data:([^;]+);/)
      const mime = mimeMatch?.[1] ?? 'image/png'
      const buf = new Uint8Array(byteString.length)
      for (let i = 0; i < byteString.length; i++) {
        buf[i] = byteString.charCodeAt(i)
      }
      blobUrl = URL.createObjectURL(new Blob([buf], { type: mime }))
    } catch {}

    const item: AiDraftItem = {
      id: buildPendingId('image'),
      type: 'image',
      dataUrl,
      ...(blobUrl ? { blobUrl } : {}),
      ...imageMeta
    }

    setPendingAiItems((current) => [...current, item])
  }, [])

  const removePendingAiItem = useCallback((id: string) => {
    setPendingAiItems((current) => {
      const removed = current.find((item) => item.id === id)
      if (removed?.type === 'image' && removed.blobUrl) {
        URL.revokeObjectURL(removed.blobUrl)
      }
      return current.filter((item) => item.id !== id)
    })
  }, [])

  const clearPendingAiItems = useCallback(() => {
    clearBrowserTextSelection()
    screenshotMetaRef.current = null
    setPendingAiItems((current) => {
      for (const item of current) {
        if (item.type === 'image' && item.blobUrl) {
          URL.revokeObjectURL(item.blobUrl)
        }
      }
      return []
    })
  }, [])

  const sendPendingAiItems = useCallback(
    async (options?: AiSendOptions): Promise<AiSendResult> => {
      const items = pendingAiItemsRef.current
      if (items.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      const result = await executeDraftSend(items, options)

      if (result.success) {
        for (const item of items) {
          if (item.type === 'image' && item.blobUrl) {
            URL.revokeObjectURL(item.blobUrl)
          }
        }
        setPendingAiItems([])
      }

      return result
    },
    [executeDraftSend]
  )

  const onScreenshotCapture = useCallback(
    async (dataUrl: string) => {
      queueImageForAi(dataUrl, screenshotMetaRef.current ?? undefined)
      screenshotMetaRef.current = null
    },
    [queueImageForAi]
  )

  const {
    isScreenshotMode,
    startScreenshot: beginScreenshot,
    closeScreenshot: closeRawScreenshot,
    handleCapture: captureScreenshot
  } = useScreenshot(onScreenshotCapture)

  const startScreenshot = useCallback(
    (imageMeta?: QueuedImageMeta) => {
      screenshotMetaRef.current = imageMeta ?? null
      beginScreenshot()
    },
    [beginScreenshot]
  )
  const closeScreenshot = useCallback(() => {
    screenshotMetaRef.current = null
    closeRawScreenshot()
  }, [closeRawScreenshot])
  const handleCapture = useCallback(
    async (dataUrl: string) => {
      try {
        await captureScreenshot(dataUrl)
      } finally {
        screenshotMetaRef.current = null
      }
    },
    [captureScreenshot]
  )
  const { isPickerActive, startPicker, togglePicker } = useElementPicker(webviewInstance)
  const startPickerWhenReady = useCallback(() => {
    pendingPickerStartRef.current = true
    setPickerStartNonce((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!pendingPickerStartRef.current || !webviewInstance) {
      return
    }

    let cancelled = false

    const waitForWebviewReady = async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (cancelled || !pendingPickerStartRef.current) {
          return
        }

        try {
          const currentUrl =
            typeof webviewInstance.getURL === 'function' ? webviewInstance.getURL() : ''
          if (!currentUrl || typeof webviewInstance.executeJavaScript !== 'function') {
            await new Promise((resolve) => setTimeout(resolve, 250))
            continue
          }

          const readyState = await webviewInstance.executeJavaScript('document.readyState')
          if (readyState === 'interactive' || readyState === 'complete') {
            pendingPickerStartRef.current = false
            await startPicker()
            return
          }
        } catch {}

        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }

    void waitForWebviewReady()

    return () => {
      cancelled = true
    }
  }, [pickerStartNonce, startPicker, webviewInstance])

  const { mutateAsync: startGeminiWebLogin, isPending: isGeminiWebLoginInProgress } =
    useGeminiWebOpenLogin()

  const stateValue = useMemo<AppToolStateType>(
    () => ({
      pendingAiItems,
      isScreenshotMode,
      autoSend,
      isPickerActive,
      isGeminiWebLoginInProgress
    }),
    [pendingAiItems, isScreenshotMode, autoSend, isPickerActive, isGeminiWebLoginInProgress]
  )

  const actionsValue = useMemo<AppToolActionsType>(
    () => ({
      startScreenshot,
      closeScreenshot,
      handleCapture,
      queueTextForAi,
      queueImageForAi,
      removePendingAiItem,
      clearPendingAiItems,
      sendPendingAiItems,
      setAutoSend,
      startPicker,
      startPickerWhenReady,
      togglePicker,
      startGeminiWebLogin
    }),
    [
      clearPendingAiItems,
      closeScreenshot,
      handleCapture,
      queueImageForAi,
      queueTextForAi,
      removePendingAiItem,
      sendPendingAiItems,
      setAutoSend,
      startGeminiWebLogin,
      startPicker,
      startPickerWhenReady,
      startScreenshot,
      togglePicker
    ]
  )

  return (
    <AppToolStateContext.Provider value={stateValue}>
      <AppToolActionsContext.Provider value={actionsValue}>
        {children}
      </AppToolActionsContext.Provider>
    </AppToolStateContext.Provider>
  )
}

export const useAppToolState = () => {
  const context = useContext(AppToolStateContext)
  if (!context) throw new Error('useAppToolState must be used within AppToolProvider')
  return context
}

export const useAppToolActions = () => {
  const context = useContext(AppToolActionsContext)
  if (!context) throw new Error('useAppToolActions must be used within AppToolProvider')
  return context
}

export const useAppTools = () => {
  const state = useAppToolState()
  const actions = useAppToolActions()

  return useMemo(
    () => ({
      ...state,
      ...actions
    }),
    [state, actions]
  )
}
