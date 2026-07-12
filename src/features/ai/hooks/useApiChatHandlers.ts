import type { ApiChatMessage } from '@shared-core/types'

import { useCallback, useRef } from 'react'

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
    activeSessionId,
    messages,
    inputValueRef,
    attachmentsRef,
    activeProviderIdRef,
    selectedModelRef,
    messagesRef,
    textareaRef,
    addAttachment,
    removeAttachment,
    updateInput,
    setSelectedModel,
    setActiveProvider,
    setActiveSessionId,
    setIsDragging,
    setIsHistoryModalOpen,
    scrollToBottom,
    t,
    sendMsgMutation,
    regenerateMutation,
    editAndRegenMutation,
    deleteMsgMutation,
    createSessionMutation,
    clearSessionMutation
  } = deps
  const dragCounterRef = useRef(0)

  const handleSend = useCallback(async () => {
    const text = inputValueRef.current
    const images = attachmentsRef.current
    if (!text.trim() && images.length === 0) return
    try {
      await sendMsgMutation({
        tabId,
        text,
        images,
        model: selectedModelRef.current,
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
    selectedModelRef,
    activeProviderIdRef
  ])

  const handleSuggestionClick = useCallback(
    async (text: string) => {
      const { generalPrompt, memoryPrompt, characterPrompt } = useChatUiStore.getState()
      try {
        await sendMsgMutation({
          tabId,
          text,
          images: [],
          model: selectedModelRef.current,
          providerId: activeProviderIdRef.current,
          generalPrompt,
          memoryPrompt,
          characterPrompt
        })
      } catch {
        /* handled by mutation */
      }
    },
    [sendMsgMutation, tabId, selectedModelRef, activeProviderIdRef]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => addAttachment(tabId, reader.result as string)
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [addAttachment, tabId]
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
      for (const file of files.filter((f) => f.type.startsWith('image/'))) {
        const reader = new FileReader()
        reader.onload = () => addAttachment(tabId, reader.result as string)
        reader.readAsDataURL(file)
      }
    },
    [addAttachment, tabId, setIsDragging]
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
