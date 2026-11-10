import type { ApiChatMessage, ApiConfig } from '@shared-core/types'

import { useToastActions } from '@shared/stores/toastStore'

import { useCallback, useRef } from 'react'

import { prepareImageForUpload } from '../lib/imageDownscale'
import { useChatUiStore } from '../store/chatUiStore'
import { useApiChatSimpleHandlers } from './useApiChatSimpleHandlers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

interface UseApiChatHandlersDeps {
  tabId: string
  activeSessionId: string | undefined
  messages: ApiChatMessage[]
  inputValueRef: React.RefObject<string>
  attachmentsRef: React.RefObject<string[]>
  activeProviderIdRef: React.RefObject<string | undefined>
  selectedModelRef: React.RefObject<string | undefined>
  /** The provider the composer currently points at, for a synchronous model check. */
  activeProvider: ApiConfig['providers'][number] | null
  messagesRef: React.RefObject<ApiChatMessage[]>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  addAttachment: (tabId: string, data: string) => void
  removeAttachment: (tabId: string, index: number) => void
  updateInput: (tabId: string, val: string) => void
  setSelectedModel: (tabId: string, model: string) => void
  setActiveProvider: (tabId: string, id: string) => void
  setActiveSessionId: (tabId: string, sessionId: string) => void
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
  setIsHistoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  scrollToBottom: (smooth?: boolean) => void
  t: (key: string) => string
  sendMsgMutation: AnyFn
  regenerateMutation: AnyFn
  editAndRegenMutation: AnyFn
  deleteMsgMutation: AnyFn
  createSessionMutation: AnyFn
  clearSessionMutation: AnyFn
}

export function useApiChatHandlers(deps: UseApiChatHandlersDeps) {
  const {
    tabId,
    inputValueRef,
    attachmentsRef,
    activeProviderIdRef,
    selectedModelRef,
    activeProvider,
    addAttachment,
    setIsDragging,
    setIsHistoryModalOpen,
    scrollToBottom,
    sendMsgMutation
  } = deps
  const dragCounterRef = useRef(0)
  const { showError, showWarning } = useToastActions()

  /** The model the current provider can actually serve. */
  const resolveRequestModel = useCallback((): string | undefined => {
    const requested = selectedModelRef.current
    if (!activeProvider) return requested
    if (!requested || !activeProvider.models?.includes(requested)) {
      return activeProvider.defaultModel || requested
    }
    return requested
  }, [activeProvider, selectedModelRef])

  const handleSend = useCallback(async () => {
    const text = inputValueRef.current
    const images = attachmentsRef.current
    if (!text.trim() && images.length === 0) return
    // Guard against concurrent sends (Enter key repeat, paste + auto-send
    // races): the mutation flips isStreaming synchronously, so reading the
    // store here deduplicates requests that would otherwise corrupt history.
    if (useChatUiStore.getState().isStreamingByTab[tabId]) return
    try {
      await sendMsgMutation({
        tabId,
        text,
        images,
        // Resolve synchronously: the provider-switch effect may not have run
        // yet, and the previous provider's model must not be sent.
        model: resolveRequestModel(),
        providerId: activeProviderIdRef.current,
        generalPrompt: useChatUiStore.getState().generalPrompt,
        memoryPrompt: useChatUiStore.getState().memoryPrompt,
        characterPrompt: useChatUiStore.getState().characterPrompt
      })
      setTimeout(() => scrollToBottom(true), 50)
    } catch {
      /* handled by mutation */
    }
  }, [
    sendMsgMutation,
    tabId,
    scrollToBottom,
    inputValueRef,
    attachmentsRef,
    activeProviderIdRef,
    resolveRequestModel
  ])

  const handleSuggestionClick = useCallback(
    async (text: string) => {
      const { generalPrompt, memoryPrompt, characterPrompt } = useChatUiStore.getState()
      try {
        await sendMsgMutation({
          tabId,
          text,
          images: [],
          model: resolveRequestModel(),
          providerId: activeProviderIdRef.current,
          generalPrompt,
          memoryPrompt,
          characterPrompt
        })
      } catch {
        /* handled by mutation */
      }
    },
    [sendMsgMutation, tabId, activeProviderIdRef, resolveRequestModel]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter during an IME composition confirms the candidate; sending here
      // would cut Japanese, Chinese or Korean input short. keyCode 229 is the
      // legacy signal some IMEs still emit.
      if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  /** Reads and downscales one image; null means the file could not be read. */
  const prepareAttachment = useCallback(async (file: File): Promise<string | null> => {
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.onabort = () => resolve(null)
      reader.readAsDataURL(file)
    })
    if (!dataUrl) return null
    try {
      return await prepareImageForUpload(dataUrl)
    } catch {
      // Downscaling is an optimisation; the original readable image is fine.
      return dataUrl
    }
  }, [])

  const addPreparedAttachments = useCallback(
    async (files: File[]) => {
      // Prepare in parallel but append in the user's selection order: a fast
      // third image must not overtake the first.
      const prepared = await Promise.all(files.map((file) => prepareAttachment(file)))
      let failed = 0
      for (const dataUrl of prepared) {
        if (dataUrl) addAttachment(tabId, dataUrl)
        else failed += 1
      }
      if (failed > 0) {
        showError('api_chat_image_read_failed', undefined, { count: String(failed) })
      }
    },
    [addAttachment, prepareAttachment, showError, tabId]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'))
      if (files.length > 0) void addPreparedAttachments(files)
      e.target.value = ''
    },
    [addPreparedAttachments]
  )

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounterRef.current += 1
        setIsDragging(true)
      }
    },
    [setIsDragging]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // The composer copies the dropped image into the message; it never moves
    // or links the source file, so the OS cursor has to say "copy".
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounterRef.current -= 1
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0
          setIsDragging(false)
        }
      }
    },
    [setIsDragging]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragging(false)
      const files = [...(e.dataTransfer?.files || [])]
      const images = files.filter((file) => file.type.startsWith('image/'))
      const rejected = files.length - images.length
      if (rejected > 0) {
        // A dropped PDF (or anything else) is a user action, not noise: say
        // why it was skipped, and still add the valid images.
        showWarning('api_chat_unsupported_files', undefined, { count: String(rejected) })
      }
      if (images.length > 0) void addPreparedAttachments(images)
    },
    [addPreparedAttachments, setIsDragging, showWarning]
  )

  const simple = useApiChatSimpleHandlers(deps)

  const handleToggleHistoryModal = useCallback(
    () => setIsHistoryModalOpen((prev) => !prev),
    [setIsHistoryModalOpen]
  )

  const handleCloseHistoryModal = useCallback(
    () => setIsHistoryModalOpen(false),
    [setIsHistoryModalOpen]
  )

  return {
    handleSend,
    handleSuggestionClick,
    handleKeyDown,
    handleFileSelect,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleToggleHistoryModal,
    handleCloseHistoryModal,
    ...simple
  }
}
