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
const EMPTY_MSGS: ApiChatMessage[] = []
const EMPTY_ATTACH: string[] = []

export function useApiChatPage(tabId: string): UseApiChatPageReturn {
  const { t } = useTranslation()
  // ---- UI state from chatUiStore ----
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

  // ---- Server state from TanStack Query ----
  const { data: messages = EMPTY_MSGS } = useMessagesQuery(activeSessionId)
  const { data: sessions = [] } = useSessionsQuery()
  const { mutateAsync: sendMsgMutation } = useSendMessageMutation()
  const { mutateAsync: regenerateMutation } = useRegenerateMutation()
  const { mutateAsync: editAndRegenMutation } = useEditAndRegenerateMutation()
  const { mutateAsync: deleteMsgMutation } = useDeleteMessageMutation()
  const { mutateAsync: createSessionMutation } = useCreateSessionMutation()
  const { mutateAsync: clearSessionMutation } = useClearSessionMutation()
  const { data: config } = useApiConfigQuery()
  // ---- Local state ----
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // ---- Refs ----
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

  // ---- Session initialization ----
  useEffect(() => {
    if (activeSessionId) return
    if (sessions.length === 0) {
      createSessionMutation().then((session) => {
        setActiveSessionId(tabId, session.session.id)
      })
      return
    }
    let mostRecent = sessions[0]
    for (let i = 1; i < sessions.length; i++) {
      if (sessions[i].updatedAt > mostRecent.updatedAt) mostRecent = sessions[i]
    }
    setActiveSessionId(tabId, mostRecent.id)
  }, [tabId, activeSessionId, sessions, createSessionMutation, setActiveSessionId])

  // ---- Config init from TanStack Query ----
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

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
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
        setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 1)
      })
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [inputValue])

  const inputAreaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = inputAreaRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (messagesEndRef.current && !isScrolledUp) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isScrolledUp])

  const activeProvider = useMemo(() => {
    if (!config) return null
    return config.providers.find((p) => p.id === activeProviderId) || null
  }, [config, activeProviderId])

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
    activeSessionId,
    inputValue,
    attachments,
    selectedModel,
    activeProviderId,
    isStreaming,
    messages,
    sessions,
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
    handleRemoveAttachmentCallback,
    handleSelectProvider,
    handleSelectModel,
    handleToggleHistoryModal,
    handleCloseHistoryModal,
    scrollToBottom
  }
}
