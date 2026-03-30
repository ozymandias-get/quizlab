import React, { createContext, useCallback, useContext, useMemo } from 'react'
import type { AiSendOptions } from '@features/ai'
import { useScreenshot } from '@features/screenshot/hooks/useScreenshot'
import { useAiActions, useAiState } from './AiContext'
import { useElementPicker } from '@features/automation/hooks/useElementPicker'
import { useGeminiWebOpenLogin } from '@platform/electron/api/useGeminiWebSessionApi'
import type { GeminiWebSessionActionResult } from '@shared-core/types'
import type { AiDraftImageItem, AiDraftItem, AiSendResult } from './ai/types'

type QueuedImageMeta = Pick<AiDraftImageItem, 'page' | 'captureKind'>

interface AppToolContextType {
  isScreenshotMode: boolean
  startScreenshot: (mode?: 'full' | 'crop', imageMeta?: QueuedImageMeta) => void
  closeScreenshot: () => void
  handleCapture: (dataUrl: string) => Promise<void>
  pendingAiItems: AiDraftItem[]
  queueTextForAi: (text: string) => void
  queueImageForAi: (dataUrl: string, imageMeta?: QueuedImageMeta) => void
  removePendingAiItem: (id: string) => void
  clearPendingAiItems: () => void
  sendPendingAiItems: (options?: AiSendOptions) => Promise<AiSendResult>
  autoSend: boolean
  setAutoSend: (value: boolean) => void
  isPickerActive: boolean
  startPicker: () => void
  startPickerWhenReady: () => void
  togglePicker: () => void
  isGeminiWebLoginInProgress: boolean
  startGeminiWebLogin: () => Promise<GeminiWebSessionActionResult>
}

const AppToolContext = createContext<AppToolContextType | null>(null)

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

function buildTextPayload(textItems: Extract<AiDraftItem, { type: 'text' }>[], noteText?: string) {
  const trimmedTextItems = textItems.map((item) => item.text.trim()).filter(Boolean)

  const sections: string[] = []
  const normalizedNote = noteText?.trim()

  if (normalizedNote) {
    sections.push(normalizedNote)
  }

  if (trimmedTextItems.length === 1) {
    sections.push(trimmedTextItems[0] || '')
  } else if (trimmedTextItems.length > 1) {
    sections.push(trimmedTextItems.join('\n\n---\n\n'))
  }

  const finalText = sections.filter(Boolean).join('\n\n')
  return finalText || undefined
}

export function AppToolProvider({ children }: { children: React.ReactNode }) {
  const { sendTextToAI, sendImageToAI, setAutoSend } = useAiActions()
  const { webviewInstance, autoSend } = useAiState()
  const [pendingAiItems, setPendingAiItems] = React.useState<AiDraftItem[]>([])
  const [pendingScreenshotMeta, setPendingScreenshotMeta] = React.useState<QueuedImageMeta | null>(
    null
  )
  const [pickerStartNonce, setPickerStartNonce] = React.useState(0)
  const pendingPickerStartRef = React.useRef(false)

  const queueTextForAi = useCallback((text: string) => {
    const normalized = text.trim()
    if (!normalized) {
      return
    }

    setPendingAiItems((current) => {
      const lastItem = current[current.length - 1]
      if (lastItem?.type === 'text' && lastItem.text === normalized) {
        return current
      }

      return [
        ...current,
        {
          id: buildPendingId('text'),
          type: 'text',
          text: normalized
        }
      ]
    })
  }, [])

  const queueImageForAi = useCallback((dataUrl: string, imageMeta?: QueuedImageMeta) => {
    if (!dataUrl.startsWith('data:image/')) {
      return
    }

    setPendingAiItems((current) => {
      const lastItem = current[current.length - 1]
      if (lastItem?.type === 'image' && lastItem.dataUrl === dataUrl) {
        return current
      }

      return [
        ...current,
        {
          id: buildPendingId('image'),
          type: 'image',
          dataUrl,
          ...imageMeta
        }
      ]
    })
  }, [])

  const removePendingAiItem = useCallback((id: string) => {
    setPendingAiItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearPendingAiItems = useCallback(() => {
    clearBrowserTextSelection()
    setPendingScreenshotMeta(null)
    setPendingAiItems([])
  }, [])

  const sendPendingAiItems = useCallback(
    async (options?: AiSendOptions): Promise<AiSendResult> => {
      if (pendingAiItems.length === 0) {
        return { success: false, error: 'invalid_input' }
      }

      const effectiveAutoSend =
        options?.forceAutoSend === true ? true : (options?.autoSend ?? autoSend)
      const textItems = pendingAiItems.filter(
        (item): item is Extract<AiDraftItem, { type: 'text' }> => item.type === 'text'
      )
      const imageItems = pendingAiItems.filter(
        (item): item is Extract<AiDraftItem, { type: 'image' }> => item.type === 'image'
      )
      const promptText = buildTextPayload(textItems, options?.promptText)

      let result: AiSendResult

      if (imageItems.length === 0) {
        if (!promptText) {
          return { success: false, error: 'invalid_input' }
        }

        result = await sendTextToAI(promptText, { autoSend: effectiveAutoSend })
      } else {
        result = { success: true }

        for (let index = 0; index < imageItems.length; index += 1) {
          const imageItem = imageItems[index]
          const isLastImage = index === imageItems.length - 1

          result = await sendImageToAI(imageItem.dataUrl, {
            autoSend: isLastImage ? effectiveAutoSend : false,
            promptText: isLastImage ? promptText : undefined
          })

          if (!result.success) {
            return result
          }
        }
      }

      if (result.success) {
        setPendingAiItems([])
      }

      return result
    },
    [autoSend, pendingAiItems, sendImageToAI, sendTextToAI]
  )

  const {
    isScreenshotMode,
    startScreenshot: beginScreenshot,
    closeScreenshot: closeRawScreenshot,
    handleCapture: captureScreenshot
  } = useScreenshot(async (dataUrl) => {
    queueImageForAi(dataUrl, pendingScreenshotMeta ?? undefined)
    setPendingScreenshotMeta(null)
  })
  const startScreenshot = useCallback(
    (mode?: 'full' | 'crop', imageMeta?: QueuedImageMeta) => {
      void mode
      setPendingScreenshotMeta(imageMeta ?? null)
      beginScreenshot()
    },
    [beginScreenshot]
  )
  const closeScreenshot = useCallback(() => {
    setPendingScreenshotMeta(null)
    closeRawScreenshot()
  }, [closeRawScreenshot])
  const handleCapture = useCallback(
    async (dataUrl: string) => {
      try {
        await captureScreenshot(dataUrl)
      } finally {
        setPendingScreenshotMeta(null)
      }
    },
    [captureScreenshot]
  )
  const { isPickerActive, startPicker, togglePicker } = useElementPicker(webviewInstance)
  const startPickerWhenReady = useCallback(() => {
    pendingPickerStartRef.current = true
    setPickerStartNonce((current) => current + 1)
  }, [])

  React.useEffect(() => {
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
        } catch {
          // Wait for the next retry while the webview is still initializing.
        }

        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }

    void waitForWebviewReady()

    return () => {
      cancelled = true
    }
  }, [pickerStartNonce, startPicker, webviewInstance])

  const { mutateAsync: openGeminiWebLogin, isPending: isGeminiWebLoginInProgress } =
    useGeminiWebOpenLogin()

  const startGeminiWebLogin = useCallback(() => openGeminiWebLogin(), [openGeminiWebLogin])

  const value = useMemo(
    () => ({
      isScreenshotMode,
      startScreenshot,
      closeScreenshot,
      handleCapture,
      pendingAiItems,
      queueTextForAi,
      queueImageForAi,
      removePendingAiItem,
      clearPendingAiItems,
      sendPendingAiItems,
      autoSend,
      setAutoSend,
      isPickerActive,
      startPicker,
      startPickerWhenReady,
      togglePicker,
      isGeminiWebLoginInProgress,
      startGeminiWebLogin
    }),
    [
      autoSend,
      clearPendingAiItems,
      closeScreenshot,
      handleCapture,
      isGeminiWebLoginInProgress,
      isPickerActive,
      isScreenshotMode,
      pendingAiItems,
      queueImageForAi,
      queueTextForAi,
      removePendingAiItem,
      sendPendingAiItems,
      startGeminiWebLogin,
      startPicker,
      startPickerWhenReady,
      startScreenshot,
      setAutoSend,
      togglePicker
    ]
  )

  return <AppToolContext.Provider value={value}>{children}</AppToolContext.Provider>
}

export const useAppTools = () => {
  const context = useContext(AppToolContext)
  if (!context) throw new Error('useAppTools must be used within AppToolProvider')
  return context
}
