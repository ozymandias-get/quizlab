import type { ApiConfig } from '@shared-core/types'

import { isVisionCapable } from '@features/ai/lib/apiChatUtils'

import { Badge } from '@app/components/ui/badge'
import { Button } from '@app/components/ui/button'
import { Textarea } from '@app/components/ui/textarea'

import { Image as ImageIcon, Send, Trash2 } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import ModelSelector from './ModelSelector'
import ProviderSelector from './ProviderSelector'

interface ChatInputProps {
  inputValue: string
  attachments: string[]
  selectedModel: string
  activeProviderId: string
  config: ApiConfig | null
  activeProvider: ApiConfig['providers'][number] | null
  isStreaming: boolean
  messageCount: number
  onInputChange: (val: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAttachment: (index: number) => void
  onClearChat: () => void
  onSelectProvider: (id: string) => void
  onSelectModel: (model: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

const ChatInput = memo(function ChatInput({
  inputValue,
  attachments,
  selectedModel,
  activeProviderId,
  config,
  activeProvider,
  isStreaming,
  messageCount,
  onInputChange,
  onSend,
  onKeyDown,
  onFileSelect,
  onRemoveAttachment,
  onClearChat,
  onSelectProvider,
  onSelectModel,
  textareaRef,
  fileInputRef
}: ChatInputProps) {
  const { t } = useTranslation()

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onInputChange(e.target.value),
    [onInputChange]
  )

  const handleFileUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [fileInputRef])

  const wordCount = inputValue.trim().split(/\s+/).filter(Boolean).length
  const charCount = inputValue.length

  return (
    <div className="bg-background/80 shrink-0 px-4 pt-2 pb-4 backdrop-blur-md">
      <div className="group relative mx-auto w-full max-w-4xl">
        {/* Main Semantic Input Card */}
        <div className="border-border/80 bg-card/90 shadow-ambient-sm focus-within:border-ring focus-within:ring-ring/40 relative w-full overflow-hidden rounded-2xl border transition-all duration-150 focus-within:ring-1">
          {attachments.length > 0 && (
            <div className="border-border/60 flex flex-wrap gap-2.5 border-b px-4 pt-3 pb-2">
              {attachments.map((data, i) => (
                // Attachments are local state — no stable id available
                // eslint-disable-next-line react/no-array-index-key -- Static bottom tool buttons, stable order
                <div key={i} className="group/attach animate-app-enter relative">
                  <div className="border-border/80 h-14 w-14 transform overflow-hidden rounded-lg border shadow-2xs">
                    <img src={data} alt="" className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(i)}
                    className="text-ql-10 border-border bg-card text-muted-foreground hover:border-destructive/40 hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-destructive/40 absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={t('api_chat_remove_attachment') || 'Remove attachment'}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-1.5">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              rows={1}
              className="text-ql-14 text-foreground placeholder:text-muted-foreground max-h-[160px] min-h-0 resize-none border-none bg-transparent px-3 py-2 leading-relaxed shadow-none focus-visible:ring-0"
              placeholder={t('api_chat_input_placeholder')}
              aria-label={t('api_chat_input_placeholder')}
            />
          </div>

          {/* Clean Sub-divider */}
          <div className="bg-border/60 mx-3 h-px" />

          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <ProviderSelector
                config={config}
                activeProvider={activeProvider}
                activeProviderId={activeProviderId}
                onSelectProvider={onSelectProvider}
              />

              <ModelSelector
                activeProvider={activeProvider}
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
              />

              {activeProvider && isVisionCapable(selectedModel) && (
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={handleFileUploadClick}
                    title={t('api_chat_upload_image')}
                    aria-label={t('api_chat_upload_image')}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {inputValue.trim() && (
                <Badge variant="muted" size="sm" className="font-mono">
                  <span>{wordCount}w</span>
                  <span className="opacity-40">·</span>
                  <span>{charCount}c</span>
                </Badge>
              )}

              {messageCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={onClearChat}
                  className="hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                  title={t('api_chat_clear')}
                  aria-label={t('api_chat_clear')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                type="button"
                variant="default"
                size="icon-sm"
                onClick={onSend}
                disabled={(!inputValue.trim() && attachments.length === 0) || isStreaming}
                title={t('api_chat_send')}
                aria-label={t('api_chat_send')}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default ChatInput
