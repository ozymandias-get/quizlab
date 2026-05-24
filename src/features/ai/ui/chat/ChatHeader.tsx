import { useLanguageStrings } from '@app/providers'
import { AiIcon } from '@ui/components/icons/AiIcon'

export function ChatHeader({
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
  const { t } = useLanguageStrings()
  return (
    <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-zinc-950/50 backdrop-blur-xl shadow-lg relative z-10">
      {/* Top golden glowing line indicator */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

      <div className="flex items-center gap-3.5">
        <div className="relative group/logo flex h-9.5 w-9.5 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-500/[0.02] border border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.12)] transition-all duration-300 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <span className="absolute inset-0 rounded-2xl bg-amber-500/5 animate-pulse" />
          <AiIcon
            modelKey="api-chat"
            className="h-5 w-5 text-amber-500 group-hover/logo:scale-110 transition-transform duration-300"
          />
        </div>
        <div>
          <div className="text-ql-15 font-bold bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text text-transparent tracking-tight">
            {t('api_chat_title') || 'API Chat'}
          </div>
          {activeProvider && (
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono mt-1 select-none bg-zinc-900/60 border border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] px-3 py-1 rounded-full w-fit hover:border-amber-500/20 transition-all duration-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/50"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-zinc-500">{providerName}</span>
              {selectedModel && <span className="text-zinc-700 font-normal">/</span>}
              {selectedModel && (
                <span className="text-zinc-300 font-semibold">{selectedModel}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleHistoryModal}
          className="group flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.15] px-4 py-2 text-ql-11 font-medium text-zinc-300 hover:text-white transition-all duration-300 active:scale-95 shadow-[0_2px_10px_rgba(0,0,0,0.2)] cursor-pointer"
          title={t('api_chat_history') || 'Sohbet Geçmişi'}
        >
          <svg
            className="h-3.5 w-3.5 text-amber-500/80 group-hover:text-amber-400 group-hover:rotate-12 transition-all duration-300 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="hidden sm:inline tracking-wide">
            {t('api_chat_history') || 'Sohbet Geçmişi'}
          </span>
        </button>

        <button
          type="button"
          onClick={onNewChat}
          className="group flex items-center gap-2 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 hover:border-amber-500/50 px-4 py-2 text-ql-11 font-semibold text-amber-400 hover:text-amber-300 transition-all duration-300 active:scale-95 shadow-[0_4px_20px_rgba(245,158,11,0.12)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.22)] cursor-pointer"
          title={t('api_chat_new_chat_tooltip') || 'Yeni Sohbet Başlat'}
        >
          <svg
            className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-300 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="hidden sm:inline tracking-wide">
            {t('api_chat_new_chat') || 'Yeni Sohbet'}
          </span>
        </button>
      </div>
    </div>
  )
}
