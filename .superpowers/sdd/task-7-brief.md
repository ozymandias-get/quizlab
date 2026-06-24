# Task 7: Extract useApiChatPage hook from ApiChatPage.tsx

**Files:**

- Modify: `src/features/ai/ui/ApiChatPage.tsx` (reduce from ~448 to ~150 lines)
- Create: `src/features/ai/hooks/useApiChatPage.ts`

**Interfaces:**

- Consumes: `tabId: string`, `chatUiStore`, TanStack Query hooks
- Produces: `useApiChatPage(tabId: string)` returning all handlers and state

## Steps

### Step 1: Read the current ApiChatPage.tsx

Read `src/features/ai/ui/ApiChatPage.tsx` to understand:

- All state selectors from `useChatUiStore`
- All TanStack Query hooks used
- All callbacks (handleSend, handleSuggestionClick, handleKeyDown, etc.)
- All effects (session init, config init, scroll, etc.)
- All refs

### Step 2: Create useApiChatPage.ts

Create `src/features/ai/hooks/useApiChatPage.ts` that returns:

```typescript
interface UseApiChatPageReturn {
  // State
  activeSessionId: string | undefined
  inputValue: string
  attachments: string[]
  selectedModel: string | undefined
  activeProviderId: string | undefined
  isStreaming: boolean
  messages: ApiChatMessage[]
  sessions: Session[]
  config: ApiConfig | undefined
  activeProvider: AiPlatform | null
  isScrolledUp: boolean
  isDragging: boolean
  isHistoryModalOpen: boolean

  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  messagesContainerRef: React.RefObject<HTMLDivElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  inputAreaRef: React.RefObject<HTMLDivElement | null>

  // Handlers
  handleSend: () => Promise<void>
  handleSuggestionClick: (text: string) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleClearChat: () => Promise<void>
  handleNewChat: () => Promise<void>
  handleDeleteMessage: (messageId: string) => Promise<void>
  handleEditMessage: (messageId: string, content: string) => Promise<void>
  handleRegenerateMessage: () => Promise<void>
  handleDragEnter: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  handleInputChange: (val: string) => void
  handleRemoveAttachmentCallback: (i: number) => void
  handleSelectProvider: (id: string) => void
  handleSelectModel: (model: string) => void
  handleToggleHistoryModal: () => void
  handleCloseHistoryModal: () => void
  scrollToBottom: (smooth?: boolean) => void
}
```

Move ALL of the following into the hook body:

- All `useChatUiStore` selectors (lines 38-50)
- All TanStack Query hooks (lines 53-61)
- All `useState` declarations (lines 63-65)
- All `useRef` declarations (lines 68-71)
- All stabilizer refs (lines 76-85)
- Session init effect (lines 88-101)
- Config init effect (lines 104-117)
- scrollToBottom (lines 119-121)
- Auto-scroll effect (lines 123-127)
- Scroll listener effect (lines 129-146)
- Textarea auto-resize effect (lines 148-153)
- Resize observer effect (lines 156-166)
- activeProvider useMemo (lines 168-171)
- ALL callbacks (lines 173-371)
- dragCounterRef (line 66)

### Step 3: Update ApiChatPage.tsx

Replace all the extracted code with:

```typescript
import type { ApiChatMessage } from '@shared-core/types'

import { lazy, memo, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiChatPage } from '../hooks/useApiChatPage'
import ChatHeader from './chat/ChatHeader'
import ChatInput from './chat/ChatInput'
import DragOverlay from './chat/DragOverlay'
import EmptyState from './chat/EmptyState'
import MessageList from './chat/MessageList'

const HistoryModal = lazy(() => import('./chat/HistoryModal'))

const EMPTY_MSGS: ApiChatMessage[] = []
const EMPTY_ATTACH: string[] = []

interface ApiChatPageProps {
  tabId: string
}

const ApiChatPage = memo(function ApiChatPage({ tabId }: ApiChatPageProps) {
  const { t } = useTranslation()
  const {
    activeSessionId, inputValue, attachments, selectedModel, activeProviderId,
    isStreaming, messages, sessions, config, activeProvider,
    isScrolledUp, isDragging, isHistoryModalOpen,
    messagesEndRef, messagesContainerRef, textareaRef, fileInputRef, inputAreaRef,
    handleSend, handleSuggestionClick, handleKeyDown, handleFileSelect,
    handleClearChat, handleNewChat, handleDeleteMessage, handleEditMessage,
    handleRegenerateMessage,
    handleDragEnter, handleDragOver, handleDragLeave, handleDrop,
    handleInputChange, handleRemoveAttachmentCallback,
    handleSelectProvider, handleSelectModel,
    handleToggleHistoryModal, handleCloseHistoryModal,
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
```

### Step 4: Verify

Run: `npx tsc --noEmit` and confirm no type errors.

### Step 5: Commit

```bash
git add src/features/ai/ui/ApiChatPage.tsx src/features/ai/hooks/useApiChatPage.ts
git commit -m "refactor(ApiChatPage): extract handlers and state into useApiChatPage hook"
```
