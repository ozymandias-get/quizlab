import type { ApiChatMessage } from '@shared-core/types'

import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ChatHeader } from './chat/ChatHeader'
import { ChatInput } from './chat/ChatInput'
import { DragOverlay } from './chat/DragOverlay'
import { EmptyState } from './chat/EmptyState'
import { MessageList } from './chat/MessageList'

const HistoryModal = lazy(() =>
  import('./chat/HistoryModal').then((m) => ({ default: m.HistoryModal }))
)

const EMPTY_MSGS: ApiChatMessage[] = []
const EMPTY_ATTACH: string[] = []

interface ApiChatPageProps {
  tabId: string
}

const ApiChatPage = memo(function ApiChatPage({ tabId }: ApiChatPageProps) {
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

  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const dragCounterRef = useRef(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Refs to prevent closures from capturing stale values and to avoid
  // recreating callbacks on every keystroke (inputValue, attachments) or
  // whenever Model/Provider selections change (selectedModel, activeProviderId).
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
      createSessionMutation().then((result) => {
        setActiveSessionId(tabId, result.session.id)
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
      // Error is already handled inside the mutation (buildErrorReply)
    }
  }, [sendMsgMutation, tabId, scrollToBottom])

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
        // handled by mutation
      }
    },
    [sendMsgMutation, tabId]
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
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }, [messages.length, createSessionMutation, setActiveSessionId, tabId])

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
        // handled by mutation
      }
    },
    [activeSessionId, editAndRegenMutation, tabId]
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
      // handled by mutation
    }
  }, [activeSessionId, regenerateMutation, tabId])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer?.types?.includes('Files')) {
      dragCounterRef.current += 1
      setIsDragging(true)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer?.types?.includes('Files')) {
      dragCounterRef.current -= 1
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsDragging(false)
      }
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragging(false)

      const files = [...(e.dataTransfer?.files || [])]
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))

      for (const file of imageFiles) {
        const reader = new FileReader()
        reader.onload = () => addAttachment(tabId, reader.result as string)
        reader.readAsDataURL(file)
      }
    },
    [addAttachment, tabId]
  )

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

  const handleToggleHistoryModal = useCallback(() => setIsHistoryModalOpen((prev) => !prev), [])

  const handleCloseHistoryModal = useCallback(() => setIsHistoryModalOpen(false), [])

  return (
    <div className="relative flex min-h-0 flex-1 bg-zinc-950/20">
      {/* Main Chat Panel */}
      <div
        role="presentation"
        className="relative flex min-h-0 flex-1 flex-col"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isDragging && <DragOverlay onDragLeave={handleDragLeave} onDrop={handleDrop} />}

        <ChatHeader
          activeProvider={!!activeProvider}
          selectedModel={selectedModel}
          providerName={activeProvider?.name || ''}
          messageCount={messages.length}
          onNewChat={handleNewChat}
          onToggleHistoryModal={handleToggleHistoryModal}
        />

        {messages.length === 0 ? (
          <EmptyState
            hasProvider={!!activeProvider}
            activeProviderName={activeProvider?.name || ''}
            activeModelName={selectedModel}
            onSuggestionClick={handleSuggestionClick}
          />
        ) : (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            isScrolledUp={isScrolledUp}
            onScrollToBottom={scrollToBottom}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            onRegenerateMessage={handleRegenerateMessage}
            containerRef={messagesContainerRef}
            endRef={messagesEndRef}
          />
        )}

        <div ref={inputAreaRef}>
          <ChatInput
            inputValue={inputValue}
            attachments={attachments}
            selectedModel={selectedModel}
            activeProviderId={activeProviderId}
            config={config ?? null}
            activeProvider={activeProvider}
            isStreaming={isStreaming}
            messageCount={messages.length}
            onInputChange={handleInputChange}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            onFileSelect={handleFileSelect}
            onRemoveAttachment={handleRemoveAttachmentCallback}
            onClearChat={handleClearChat}
            onSelectProvider={handleSelectProvider}
            onSelectModel={handleSelectModel}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
          />
        </div>
      </div>

      {/* Persisted Sessions History Modal */}
      <Suspense fallback={null}>
        <HistoryModal isOpen={isHistoryModalOpen} onClose={handleCloseHistoryModal} tabId={tabId} />
      </Suspense>
    </div>
  )
})

ApiChatPage.displayName = 'ApiChatPage'

export default ApiChatPage
