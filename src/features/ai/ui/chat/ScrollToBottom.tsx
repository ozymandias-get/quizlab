import { useLanguageStrings } from '@app/providers'

export function ScrollToBottom({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  const { t } = useLanguageStrings()
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-white/8 bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 text-ql-11 text-white/50 hover:text-white/80 hover:border-white/16 shadow-lg transition-all active:scale-95"
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
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {t('api_chat_scroll_to_bottom') || 'Scroll to bottom'}
    </button>
  )
}
