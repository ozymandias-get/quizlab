import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLanguageStrings } from '@app/providers'
import { useApiChatStore } from '@features/ai/store/apiChatStore'
import type { ApiConfig, ApiChatMessage } from '@shared-core/types'
import { ChatHeader } from './chat/ChatHeader'
import { EmptyState } from './chat/EmptyState'
import { MessageList } from './chat/MessageList'
import { ChatInput } from './chat/ChatInput'
import { HistoryModal } from './chat/HistoryModal'
import { DragOverlay } from './chat/DragOverlay'

const EMPTY_MSGS: ApiChatMessage[] = []
const EMPTY_ATTACH: string[] = []

interface ApiChatPageProps {
  tabId: string
}

export default function ApiChatPage({ tabId }: ApiChatPageProps) {
  const { t } = useLanguageStrings()
  const messages = useApiChatStore((s) => s.messagesByTab[tabId]) ?? EMPTY_MSGS
  const inputValue = useApiChatStore((s) => s.inputValueByTab[tabId]) ?? ''
  const attachments = useApiChatStore((s) => s.attachmentsByTab[tabId]) ?? EMPTY_ATTACH
  const selectedModel = useApiChatStore((s) => s.selectedModelByTab[tabId] || s.selectedModel)
  const activeProviderId = useApiChatStore(
    (s) => s.activeProviderByTab[tabId] || s.activeProviderId
  )
  const isStreaming = useApiChatStore((s) => s.isStreamingByTab[tabId]) ?? false
  const [config, setConfig] = useState<ApiConfig | null>(null)
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // History Modal Open State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateInput = useApiChatStore((s) => s.updateInput)
  const addAttachment = useApiChatStore((s) => s.addAttachment)
  const removeAttachment = useApiChatStore((s) => s.removeAttachment)
  const sendMessage = useApiChatStore((s) => s.sendMessage)
  const clearMessages = useApiChatStore((s) => s.clearMessages)
  const deleteMessage = useApiChatStore((s) => s.deleteMessage)
  const editAndRegenerate = useApiChatStore((s) => s.editAndRegenerate)
  const regenerateResponse = useApiChatStore((s) => s.regenerateResponse)
  const setSelectedModelForTab = useApiChatStore((s) => s.setSelectedModelForTab)
  const setActiveProviderForTab = useApiChatStore((s) => s.setActiveProviderForTab)
  const setConfigFromSettings = useApiChatStore((s) => s.setConfigFromSettings)
  const initTabSession = useApiChatStore((s) => s.initTabSession)

  // Persisted Sessions Store Actions
  const createSession = useApiChatStore((s) => s.createSession)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (api?.getApiChatConfig) {
      api
        .getApiChatConfig()
        .then((cfg: ApiConfig) => {
          setConfig(cfg)
          setConfigFromSettings(cfg)
          if (cfg.selectedProviderId && !activeProviderId) {
            setActiveProviderForTab(tabId, cfg.selectedProviderId)
          }
          if (cfg.selectedModel && !selectedModel) {
            setSelectedModelForTab(tabId, cfg.selectedModel)
          }
        })
        .catch(console.error)
    }

    // Initialize session for this tab
    initTabSession(tabId)
  }, [tabId])

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (!isScrolledUp) {
      scrollToBottom(!isStreaming)
    }
  }, [messages, isStreaming])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 60)
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [inputValue])

  const activeProvider = useMemo(() => {
    if (!config) return null
    return config.providers.find((p) => p.id === activeProviderId) || null
  }, [config, activeProviderId])

  const handleSend = useCallback(() => {
    if (!inputValue.trim() && attachments.length === 0) return
    sendMessage(tabId)
    setTimeout(() => scrollToBottom(true), 50)
  }, [inputValue, attachments.length, sendMessage, tabId, scrollToBottom])

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

  const handleClearChat = useCallback(() => {
    if (
      confirm(
        t('api_chat_confirm_clear_messages') ||
          'Bu sohbetin tüm mesajlarını temizlemek istediğinizden emin misiniz? Sohbet geçmişi silinmeyecek, boş bir sohbet olarak kalacaktır.'
      )
    ) {
      clearMessages(tabId)
    }
  }, [clearMessages, tabId, t])

  const handleNewChat = useCallback(() => {
    if (messages.length > 0) {
      createSession(tabId)
    }
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }, [messages.length, createSession, tabId])

  const handleDeleteMessage = useCallback(
    (messageId: string) => deleteMessage(tabId, messageId),
    [deleteMessage, tabId]
  )

  const handleEditMessage = useCallback(
    (messageId: string, content: string) => editAndRegenerate(tabId, messageId, content),
    [editAndRegenerate, tabId]
  )

  const handleRegenerateMessage = useCallback(
    () => regenerateResponse(tabId),
    [regenerateResponse, tabId]
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer?.files || [])
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))

      imageFiles.forEach((file) => {
        const reader = new FileReader()
        reader.onload = () => addAttachment(tabId, reader.result as string)
        reader.readAsDataURL(file)
      })
    },
    [addAttachment, tabId]
  )

  return (
    <div className="flex-1 flex min-h-0 relative bg-zinc-950/20">
      {/* Main Chat Panel */}
      <div
        className="flex-1 flex flex-col min-h-0 relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
      >
        {isDragging && <DragOverlay onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} />}

        <ChatHeader
          activeProvider={!!activeProvider}
          selectedModel={selectedModel}
          providerName={activeProvider?.name || ''}
          messageCount={messages.length}
          onNewChat={handleNewChat}
          onToggleHistoryModal={() => setIsHistoryModalOpen(!isHistoryModalOpen)}
        />

        {messages.length === 0 ? (
          <EmptyState
            hasProvider={!!activeProvider}
            activeProviderName={activeProvider?.name || ''}
            activeModelName={selectedModel}
            onSuggestionClick={(text) => {
              sendMessage(tabId, text)
            }}
          />
        ) : (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            isScrolledUp={isScrolledUp}
            onScrollToBottom={() => scrollToBottom(true)}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            onRegenerateMessage={handleRegenerateMessage}
            containerRef={messagesContainerRef}
            endRef={messagesEndRef}
          />
        )}

        <ChatInput
          inputValue={inputValue}
          attachments={attachments}
          selectedModel={selectedModel}
          activeProviderId={activeProviderId}
          config={config}
          activeProvider={activeProvider}
          isStreaming={isStreaming}
          messageCount={messages.length}
          onInputChange={(val) => updateInput(tabId, val)}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          onFileSelect={handleFileSelect}
          onRemoveAttachment={(i) => removeAttachment(tabId, i)}
          onClearChat={handleClearChat}
          onSelectProvider={(id) => setActiveProviderForTab(tabId, id)}
          onSelectModel={(model) => setSelectedModelForTab(tabId, model)}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef}
        />
      </div>

      {/* Persisted Sessions History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        tabId={tabId}
      />
    </div>
  )
}
