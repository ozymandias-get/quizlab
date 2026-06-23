import { AiIcon } from '@ui/components/icons/AiIcon'

import { Clock, Plus } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export const ChatHeader = memo(function ChatHeader({
  activeProvider,
  selectedModel,
  providerName,
  onNewChat,
  onToggleHistoryModal
}: {
  activeProvider: boolean
  selectedModel: string
  providerName: string
  messageCount: number
  onNewChat: () => void
  onToggleHistoryModal: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-zinc-950/95 px-6 py-4">
      <div className="flex items-center gap-3.5">
        <div className="group/logo relative flex h-9.5 w-9.5 items-center justify-center rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/15 to-amber-500/[0.02] shadow-[0_0_15px_rgba(245,158,11,0.12)] transition-colors duration-300 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <AiIcon
            modelKey="api-chat"
            className="h-5 w-5 text-amber-500 transition-transform duration-300 group-hover/logo:scale-110"
          />
        </div>
        <div>
          <div className="text-ql-15 bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text font-bold tracking-tight text-transparent">
            {t('api_chat_title')}
          </div>
          {activeProvider && (
            <div className="text-ql-10 mt-1 flex w-fit items-center gap-1.5 rounded-full border border-white/[0.06] bg-zinc-900/60 px-3 py-1 font-mono text-zinc-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] transition-colors duration-300 select-none hover:border-amber-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-zinc-500">{providerName}</span>
              {selectedModel && <span className="font-normal text-zinc-700">/</span>}
              {selectedModel && (
                <span className="font-semibold text-zinc-300">{selectedModel}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleHistoryModal}
          className="group text-ql-11 flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 font-medium text-zinc-300 shadow-[0_2px_10px_rgba(0,0,0,0.2)] transition-colors duration-300 hover:border-white/[0.15] hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-95"
          title={t('api_chat_history')}
          aria-label={t('api_chat_history')}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500/80 transition-colors duration-300 group-hover:rotate-12 group-hover:text-amber-400" />
          <span className="hidden tracking-wide sm:inline">{t('api_chat_history')}</span>
        </button>

        <button
          type="button"
          onClick={onNewChat}
          className="group text-ql-11 flex cursor-pointer items-center gap-2 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-amber-600/10 px-4 py-2 font-semibold text-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.12)] transition-colors duration-300 hover:border-amber-500/50 hover:from-amber-500/25 hover:to-amber-600/20 hover:text-amber-300 hover:shadow-[0_4px_25px_rgba(245,158,11,0.22)] focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none active:scale-95"
          title={t('api_chat_new_chat_tooltip')}
          aria-label={t('api_chat_new_chat_tooltip')}
        >
          <Plus className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover:rotate-90" />
          <span className="hidden tracking-wide sm:inline">{t('api_chat_new_chat')}</span>
        </button>
      </div>
    </div>
  )
})
