import type { ApiConfig } from '@shared-core/types'

import { isVisionCapable } from '@features/ai/lib/apiChatUtils'

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

  // Stable callbacks to prevent unnecessary re-creation on every parent render.
  // Even though ChatInput itself re-renders when inputValue changes, these
  // handlers being stable reduces the cost of React's event delegation updates.
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onInputChange(e.target.value),
    [onInputChange]
  )

  const handleFileUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="shrink-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent px-4 pt-2 pb-5">
      <div className="group relative mx-auto w-full max-w-4xl">
        {/* Soft, premium glowing gradient aura that wakes up on focus */}
        <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 opacity-0 blur-xl transition-colors duration-500 group-focus-within:opacity-100" />

        {/* Main Glassmorphic Input Card */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] border-t-white/[0.15] bg-gradient-to-b from-zinc-900/95 to-zinc-950/99 shadow-2xl shadow-black/80 transition-colors duration-300 focus-within:border-amber-500/40 focus-within:shadow-[0_0_30px_rgba(245,158,11,0.08),inset_0_1px_1px_rgba(255,255,255,0.05)]">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2.5 border-b border-white/[0.04] px-4 pt-3.5 pb-2">
              {attachments.map((data, i) => (
                // Attachments are local state — no stable id available
                // eslint-disable-next-line react/no-array-index-key -- Static bottom tool buttons, stable order
                <div key={i} className="group/attach animate-app-enter relative">
                  <div className="h-16 w-16 transform overflow-hidden rounded-xl shadow-lg ring-1 ring-white/15 transition-colors duration-300 hover:scale-105 hover:ring-amber-500/40">
                    <img src={data} alt="" className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(i)}
                    className="text-ql-10 absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-zinc-950/90 text-white/50 ring-1 ring-white/10 transition-colors hover:bg-rose-500/80 hover:text-white hover:ring-rose-500/40 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
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
              className="text-ql-14 max-h-[160px] min-h-0 border-none bg-transparent px-3.5 py-3 shadow-none"
              placeholder={t('api_chat_input_placeholder')}
            />
          </div>

          {/* Glowing Translucent Divider */}
          <div className="mx-4 h-[1px] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
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
                  <button
                    type="button"
                    onClick={handleFileUploadClick}
                    className="flex h-8 min-h-11 w-8 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] shadow-sm transition-colors hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-95"
                    title={t('api_chat_upload_image')}
                    aria-label={t('api_chat_upload_image')}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {inputValue.trim() && (
                <div className="text-ql-10 flex items-center gap-1.5 rounded-full border border-white/[0.04] bg-zinc-950/40 px-2.5 py-1 font-mono text-zinc-500 shadow-inner select-none">
                  <span className="text-zinc-400">
                    {inputValue.trim().split(/\s+/).filter(Boolean).length}w
                  </span>
                  <span className="text-zinc-600 opacity-30">·</span>
                  <span className="text-zinc-400">{inputValue.length}c</span>
                </div>
              )}

              {messageCount > 0 && (
                <button
                  type="button"
                  onClick={onClearChat}
                  className="flex h-8 min-h-11 w-8 min-w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none active:scale-95"
                  title={t('api_chat_clear')}
                  aria-label={t('api_chat_clear')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onSend}
                disabled={(!inputValue.trim() && attachments.length === 0) || isStreaming}
                className="group flex h-8.5 min-h-11 w-8.5 min-w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/15 transition-colors duration-200 hover:scale-105 hover:shadow-amber-500/35 hover:brightness-105 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-90 disabled:cursor-not-allowed disabled:border disabled:border-white/[0.02] disabled:from-zinc-900 disabled:to-zinc-950 disabled:text-white/10 disabled:shadow-none"
                title={t('api_chat_send')}
                aria-label={t('api_chat_send')}
              >
                <Send className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default ChatInput
