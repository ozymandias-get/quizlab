import type { ApiChatMessage } from '@shared-core/types'

import { useCallback } from 'react'

import { useChatUiStore } from '../store/chatUiStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

interface UseApiChatSimpleHandlersDeps {
  tabId: string
  activeSessionId: string | undefined
  messages: ApiChatMessage[]
  inputValueRef: React.RefObject<string>
  attachmentsRef: React.RefObject<string[]>
  activeProviderIdRef: React.RefObject<string | undefined>
  selectedModelRef: React.RefObject<string | undefined>
  messagesRef: React.RefObject<ApiChatMessage[]>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  addAttachment: (tabId: string, data: string) => void
  removeAttachment: (tabId: string, index: number) => void
  updateInput: (tabId: string, val: string) => void
  setSelectedModel: (tabId: string, model: string) => void
  setActiveProvider: (tabId: string, id: string) => void
  setActiveSessionId: (tabId: string, sessionId: string) => void
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
  scrollToBottom: (smooth?: boolean) => void
  t: (key: string) => string
  sendMsgMutation: AnyFn
  regenerateMutation: AnyFn
  editAndRegenMutation: AnyFn
  deleteMsgMutation: AnyFn
  createSessionMutation: AnyFn
  clearSessionMutation: AnyFn
}

export function useApiChatSimpleHandlers(deps: UseApiChatSimpleHandlersDeps) {
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
    scrollToBottom,
    t,
    sendMsgMutation,
    regenerateMutation,
    editAndRegenMutation,
    deleteMsgMutation,
    createSessionMutation,
    clearSessionMutation
  } = deps

  const handleClearChat = useCallback(async () => {
    if (!activeSessionId) return
    if (confirm(t('api_chat_confirm_clear_messages'))) {
      await clearSessionMutation(activeSessionId)
    }
  }, [activeSessionId, clearSessionMutation, t])

  const handleNewChat = useCallback(async () => {
    if (messages.length > 0) {
      const result = await createSessionMutation()
      setActiveSessionId(tabId, result.session.id)
    }
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [messages.length, createSessionMutation, setActiveSessionId, tabId, textareaRef])

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeSessionId) return
      await deleteMsgMutation({ sessionId: activeSessionId, messageId })
    },
    [deleteMsgMutation, activeSessionId]
  )

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!activeSessionId) return
      const { generalPrompt, memoryPrompt, characterPrompt } = useChatUiStore.getState()
      try {
        await editAndRegenMutation({
          tabId,
          messageId,
          newContent: content,
          messages: messagesRef.current,
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
    [
      activeSessionId,
      editAndRegenMutation,
      tabId,
      messagesRef,
      selectedModelRef,
      activeProviderIdRef
    ]
  )

  const handleRegenerateMessage = useCallback(async () => {
    if (!activeSessionId) return
    const { generalPrompt, memoryPrompt, characterPrompt } = useChatUiStore.getState()
    try {
      await regenerateMutation({
        tabId,
        messages: messagesRef.current,
        model: selectedModelRef.current,
        providerId: activeProviderIdRef.current,
        generalPrompt,
        memoryPrompt,
        characterPrompt
      })
    } catch {
      /* handled by mutation */
    }
  }, [
    activeSessionId,
    regenerateMutation,
    tabId,
    messagesRef,
    selectedModelRef,
    activeProviderIdRef
  ])

  const handleInputChange = useCallback(
    (val: string) => updateInput(tabId, val),
    [updateInput, tabId]
  )

  const handleRemoveAttachmentCallback = useCallback(
    (i: number) => removeAttachment(tabId, i),
    [removeAttachment, tabId]
  )

  const handleSelectProvider = useCallback(
    (id: string) => setActiveProvider(tabId, id),
    [setActiveProvider, tabId]
  )

  const handleSelectModel = useCallback(
    (model: string) => setSelectedModel(tabId, model),
    [setSelectedModel, tabId]
  )

  return {
    handleClearChat,
    handleNewChat,
    handleDeleteMessage,
    handleEditMessage,
    handleRegenerateMessage,
    handleInputChange,
    handleRemoveAttachmentCallback,
    handleSelectProvider,
    handleSelectModel
  }
}
