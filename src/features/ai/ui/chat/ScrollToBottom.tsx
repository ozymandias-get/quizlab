import { Button } from '@app/components/ui/button'

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
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onClick}
      className="text-ql-11 border-border bg-popover/90 text-muted-foreground shadow-ambient-md absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border backdrop-blur-md"
    >
      <ChevronDown className="h-3.5 w-3.5" />
      {t('api_chat_scroll_to_bottom')}
    </Button>
  )
})

export default ScrollToBottom
