import { Button } from '@shared/ui/components/primitives'

import { ChevronDown } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

const ScrollToBottom = memo(function ScrollToBottom({
  onClick,
  visible,
  count = 0
}: {
  onClick: () => void
  visible: boolean
  /** Messages added while the reader was away from the bottom. */
  count?: number
}) {
  const { t } = useTranslation()
  if (!visible) return null
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onClick}
      className="text-ql-11 border-border bg-card/95 text-muted-foreground shadow-ambient-md absolute right-4 bottom-4 z-10 rounded-full border"
    >
      <ChevronDown className="h-3.5 w-3.5" />
      {t('api_chat_scroll_to_bottom')}
      {count > 0 && (
        <span
          aria-label={t('api_chat_unread_count', { count: String(count) })}
          className="bg-primary text-primary-foreground ml-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full px-1 py-0 text-[10px] font-semibold tabular-nums"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  )
})

export default ScrollToBottom
