import { ChevronDown } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

const ScrollToBottom = memo(function ScrollToBottom({
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
      className="text-ql-11 border-border bg-popover/90 text-muted-foreground shadow-ambient-md hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1 font-medium backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <ChevronDown className="h-3.5 w-3.5" />
      {t('api_chat_scroll_to_bottom')}
    </button>
  )
})

export default ScrollToBottom
