import type { ApiChatMessage } from '@shared-core/types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDeleteMessageMutation, useMessagesQuery } from '../queries/useMessagesQuery'
import { useApiConfigQuery } from '../queries/useProviderQueries'
import {
  useEditAndRegenerateMutation,
  useRegenerateMutation,
  useSendMessageMutation
} from '../queries/useSendMessageMutation'
import {
  useClearSessionMutation,
  useCreateSessionMutation,
  useSessionsQuery
} from '../queries/useSessionsQuery'
import { useChatUiStore } from '../store/chatUiStore'
import { useApiChatHandlers } from './useApiChatHandlers'
import type { UseApiChatPageReturn } from './useApiChatPageTypes'
import { useApiChatSessionInit } from './useApiChatSessionInit'
const EMPTY_MSGS: ApiChatMessage[] = []
const EMPTY_ATTACH: string[] = []

export function useApiChatPage(tabId: string): UseApiChatPageReturn {
  const { t } = useTranslation()
  // UI state from chatUiStore
  const activeSessionId = useChatUiStore((s) => s.activeSessionIdByTab[tabId])
  const inputValue = useChatUiStore((s) => s.inputValueByTab[tabId]) ?? ''
  const attachments = useChatUiStore((s) => s.attachmentsByTab[tabId]) ?? EMPTY_ATTACH
  const selectedModel = useChatUiStore((s) => s.selectedModelByTab[tabId])
  const activeProviderId = useChatUiStore((s) => s.activeProviderByTab[tabId])
  const isStreaming = useChatUiStore((s) => s.isStreamingByTab[tabId]) ?? false
  const updateInput = useChatUiStore((s) => s.updateInput)
  const addAttachment = useChatUiStore((s) => s.addAttachment)
  const removeAttachment = useChatUiStore((s) => s.removeAttachment)
  const setSelectedModel = useChatUiStore((s) => s.setSelectedModel)
  const setActiveProvider = useChatUiStore((s) => s.setActiveProvider)
  const setConfigPrompts = useChatUiStore((s) => s.setConfigPrompts)
  const setActiveSessionId = useChatUiStore((s) => s.setActiveSessionId)

  // Server state from TanStack Query
  const { data: messages = EMPTY_MSGS } = useMessagesQuery(activeSessionId)
  const { data: sessions = [], isSuccess: sessionsLoaded } = useSessionsQuery()
  const { mutateAsync: sendMsgMutation } = useSendMessageMutation()
  const { mutateAsync: regenerateMutation } = useRegenerateMutation()
  const { mutateAsync: editAndRegenMutation } = useEditAndRegenerateMutation()
  const { mutateAsync: deleteMsgMutation } = useDeleteMessageMutation()
  const { mutateAsync: createSessionMutation } = useCreateSessionMutation()
  const { mutateAsync: clearSessionMutation } = useClearSessionMutation()
  const { data: config } = useApiConfigQuery()
  // Local state
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  // MessageList owns the scroll container and only mounts once there is a
  // message. The listener effect below must re-run on that mount, not only on
  // the hook's first render (where the ref is still empty).
  const hasMessages = messages.length > 0

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Refs to prevent closures from capturing stale values
  const inputValueRef = useRef(inputValue)
  inputValueRef.current = inputValue
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments
  const activeProviderIdRef = useRef(activeProviderId)
  activeProviderIdRef.current = activeProviderId
  const selectedModelRef = useRef(selectedModel)
  selectedModelRef.current = selectedModel
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useApiChatSessionInit({
    tabId,
    activeSessionId,
    sessions,
    createSessionMutation,
    setActiveSessionId,
    enabled: sessionsLoaded
  })

  useEffect(() => {
    if (!config) return
    setConfigPrompts({
      generalPrompt: config.generalPrompt || '',
      memoryPrompt: config.memoryPrompt || '',
      characterPrompt: config.characterPrompt || ''
    })
    if (config.selectedProviderId && !activeProviderIdRef.current) {
      setActiveProvider(tabId, config.selectedProviderId)
    }
    if (config.selectedModel && !selectedModelRef.current) {
      setSelectedModel(tabId, config.selectedModel)
    }
  }, [config, tabId, setConfigPrompts, setActiveProvider, setSelectedModel])

  // Scrolling is coalesced into one frame: a streaming reply replaces the
  // messages array many times per second, and each replacement used to call
  // `scrollIntoView` synchronously, forcing a layout every time.
  const scrollFrameRef = useRef<number | null>(null)
  const pendingSmoothRef = useRef(true)

  const scrollToBottom = useCallback((smooth = true) => {
    pendingSmoothRef.current = smooth
    if (scrollFrameRef.current !== null) return
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null
      messagesEndRef.current?.scrollIntoView({
        behavior: pendingSmoothRef.current ? 'smooth' : 'auto'
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isScrolledUp) {
      scrollToBottom(!isStreaming)
    }
  }, [messages, isStreaming, isScrolledUp, scrollToBottom])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    let rafId: number | null = null
    const handleScroll = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const { scrollTop, scrollHeight, clientHeight } = container
        // Sub-pixel layout, zoom and fractional heights can leave a few pixels
        // at the bottom while the reader is still following the stream.
        setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 8)
      })
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [hasMessages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`
  }, [inputValue])

  const inputAreaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = inputAreaRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (messagesEndRef.current && !isScrolledUp) {
        // Same coalesced path as the message effect, so a composer resize and a
        // streaming update in the same frame scroll once.
        scrollToBottom(false)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isScrolledUp, scrollToBottom])

  const activeProvider = useMemo(() => {
    if (!config) return null
    return config.providers?.find((p) => p.id === activeProviderId) || null
  }, [config, activeProviderId])

  // A provider switch must not carry the previous provider's model into the
  // request. When the selected model is not one the new provider serves, fall
  // back to that provider's default instead of sending an incompatible id.
  useEffect(() => {
    if (!activeProvider) return
    const currentModel = selectedModelRef.current
    if (currentModel && !activeProvider.models?.includes(currentModel)) {
      setSelectedModel(tabId, activeProvider.defaultModel || '')
    }
  }, [activeProvider, tabId, setSelectedModel])

  const {
    handleSend,
    handleSuggestionClick,
    handleKeyDown,
    handleFileSelect,
    handleClearChat,
    handleNewChat,
    handleDeleteMessage,
    handleEditMessage,
    handleRegenerateMessage,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInputChange,
    handleStop,
    handleRemoveAttachmentCallback,
    handleSelectProvider,
    handleSelectModel,
    handleToggleHistoryModal,
    handleCloseHistoryModal
  } = useApiChatHandlers({
    tabId,
    activeSessionId,
    messages,
    inputValueRef,
    attachmentsRef,
    activeProviderIdRef,
    selectedModelRef,
    activeProvider,
    messagesRef,
    textareaRef,
    messagesEndRef,
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
  })

  return {
    inputValue,
    attachments,
    selectedModel,
    activeProviderId,
    isStreaming,
    messages,
    config,
    activeProvider,
    isScrolledUp,
    isDragging,
    isHistoryModalOpen,
    messagesEndRef,
    messagesContainerRef,
    textareaRef,
    fileInputRef,
    inputAreaRef,
    handleSend,
    handleSuggestionClick,
    handleKeyDown,
    handleFileSelect,
    handleClearChat,
    handleNewChat,
    handleDeleteMessage,
    handleEditMessage,
    handleRegenerateMessage,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInputChange,
    handleStop,
    handleRemoveAttachmentCallback,
    handleSelectProvider,
    handleSelectModel,
    handleToggleHistoryModal,
    handleCloseHistoryModal,
    scrollToBottom
  }
}
