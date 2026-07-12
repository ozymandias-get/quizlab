import type { ApiChatMessage, ApiConfig, ApiProviderConfig } from '@shared-core/types'

import type { ChatSession } from '../store/apiChatSessionUtils'

export interface UseApiChatPageReturn {
  activeSessionId: string | undefined
  inputValue: string
  attachments: string[]
  selectedModel: string | undefined
  activeProviderId: string | undefined
  isStreaming: boolean
  messages: ApiChatMessage[]
  sessions: ChatSession[]
  config: ApiConfig | null | undefined
  activeProvider: ApiProviderConfig | null
  isScrolledUp: boolean
  isDragging: boolean
  isHistoryModalOpen: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  messagesContainerRef: React.RefObject<HTMLDivElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  inputAreaRef: React.RefObject<HTMLDivElement | null>
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
