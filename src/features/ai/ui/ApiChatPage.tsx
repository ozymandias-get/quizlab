import { lazy, memo, Suspense } from 'react'

import { useApiChatPage } from '../hooks/useApiChatPage'
import ChatHeader from './chat/ChatHeader'
import ChatInput from './chat/ChatInput'
import DragOverlay from './chat/DragOverlay'
import EmptyState from './chat/EmptyState'
import MessageList from './chat/MessageList'

const HistoryModal = lazy(() => import('./chat/HistoryModal'))

interface ApiChatPageProps {
  tabId: string
}

const ApiChatPage = memo(function ApiChatPage({ tabId }: ApiChatPageProps) {
  const {
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
    handleRemoveAttachmentCallback,
    handleSelectProvider,
    handleSelectModel,
    handleToggleHistoryModal,
    handleCloseHistoryModal,
    scrollToBottom
  } = useApiChatPage(tabId)

  return (
    <div className="relative flex min-h-0 flex-1 bg-zinc-950/20">
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

      <Suspense fallback={null}>
        <HistoryModal isOpen={isHistoryModalOpen} onClose={handleCloseHistoryModal} tabId={tabId} />
      </Suspense>
    </div>
  )
})

ApiChatPage.displayName = 'ApiChatPage'

export default ApiChatPage
