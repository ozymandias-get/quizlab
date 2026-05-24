import { useLanguageStrings } from '@app/providers'
import { isVisionCapable } from '@features/ai/lib/apiChatUtils'
import type { ApiConfig } from '@shared-core/types'
import { ModelSelector } from './ModelSelector'
import { ProviderSelector } from './ProviderSelector'

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

export function ChatInput({
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
  const { t } = useLanguageStrings()

  return (
    <div className="shrink-0 px-4 pb-5 pt-2 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent">
      <div className="w-full max-w-4xl mx-auto relative group">
        {/* Soft, premium glowing gradient aura that wakes up on focus */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 opacity-0 group-focus-within:opacity-100 blur-xl transition-all duration-500 pointer-events-none" />

        {/* Main Glassmorphic Input Card */}
        <div className="relative w-full rounded-2xl border border-white/[0.08] border-t-white/[0.15] bg-gradient-to-b from-zinc-900/50 to-zinc-950/70 backdrop-blur-2xl shadow-2xl shadow-black/80 focus-within:border-amber-500/40 focus-within:shadow-[0_0_30px_rgba(245,158,11,0.08),inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all duration-300">
          {attachments.length > 0 && (
            <div className="flex gap-2.5 px-4 pt-3.5 pb-2 flex-wrap border-b border-white/[0.04]">
              {attachments.map((data, i) => (
                <div key={i} className="relative group/attach animate-app-enter">
                  <div className="h-16 w-16 rounded-xl overflow-hidden ring-1 ring-white/15 hover:ring-amber-500/40 shadow-lg transform hover:scale-105 transition-all duration-300">
                    <img src={data} alt="" className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(i)}
                    className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-zinc-950/90 text-white/50 hover:text-white hover:bg-rose-500/80 ring-1 ring-white/10 hover:ring-rose-500/40 transition-all text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-1.5">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none focus:border-0 text-ql-14 text-white/90 placeholder:text-zinc-500/90 leading-relaxed font-normal py-3 px-3.5 w-full resize-none min-h-[44px] max-h-[160px] custom-scrollbar outline-none shadow-none"
              placeholder={t('api_chat_input_placeholder') || 'Bir mesaj yazın...'}
            />
          </div>

          {/* Glowing Translucent Divider */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent mx-4" />

          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
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
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 transition-all cursor-pointer shadow-sm active:scale-95"
                    title={t('api_chat_upload_image') || 'Görsel Yükle'}
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {inputValue.trim() && (
                <div className="hidden md:flex items-center gap-1.5 text-ql-10 font-mono text-zinc-500 select-none bg-zinc-950/40 border border-white/[0.04] px-2.5 py-1 rounded-full shadow-inner">
                  <span className="text-zinc-400">
                    {inputValue.trim().split(/\s+/).filter(Boolean).length}w
                  </span>
                  <span className="opacity-30 text-zinc-600">•</span>
                  <span className="text-zinc-400">{inputValue.length}c</span>
                </div>
              )}

              {messageCount > 0 && (
                <button
                  type="button"
                  onClick={onClearChat}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all active:scale-95"
                  title={t('api_chat_clear') || 'Sohbeti Temizle'}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={onSend}
                disabled={(!inputValue.trim() && attachments.length === 0) || isStreaming}
                className="group flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-600 disabled:from-zinc-900 disabled:to-zinc-950 disabled:border disabled:border-white/[0.02] disabled:text-white/10 text-zinc-950 transition-all duration-200 active:scale-90 hover:scale-105 disabled:cursor-not-allowed shadow-lg shadow-amber-500/15 disabled:shadow-none hover:shadow-amber-500/35 hover:brightness-105"
                title={t('api_chat_send') || 'Gönder'}
              >
                <svg
                  className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
