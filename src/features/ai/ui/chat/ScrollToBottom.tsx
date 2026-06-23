import { ChevronDown } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

export const ScrollToBottom = memo(function ScrollToBottom({
  onClick,
  visible
}: {
  onClick: () => void
  visible: boolean
}) {
  const { t } = useTranslation()
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ql-11 absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/8 bg-zinc-900/90 px-3 py-1.5 text-white/50 shadow-lg backdrop-blur-md transition-colors hover:border-white/16 hover:text-white/80 active:scale-95"
    >
      <ChevronDown className="h-3.5 w-3.5" />
      {t('api_chat_scroll_to_bottom')}
    </button>
  )
})
