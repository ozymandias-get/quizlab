import { Button, WithTooltip } from '@shared/ui/components/primitives'
import { AiIcon } from '@ui/components/icons/AiIcon'

import { Clock, Plus } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

const ChatHeader = memo(function ChatHeader({
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
    <div className="border-border/50 bg-card/95 relative z-10 flex shrink-0 items-center justify-between border-b px-4 py-2.5 sm:px-6 sm:py-3">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
          <AiIcon modelKey="api-chat" className="h-4 w-4" />
        </div>
        <div>
          <div className="text-ql-13 text-foreground font-semibold">{t('api_chat_title')}</div>
          {activeProvider && (
            <div className="text-ql-10 border-border/45 bg-muted/40 text-muted-foreground mt-0.5 flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono select-none">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span>{providerName}</span>
              {selectedModel && <span className="text-border">/</span>}
              {selectedModel && (
                <span className="text-foreground font-semibold">{selectedModel}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Archive is a secondary tool: icon-only and quiet. The primary
            action keeps the accent tint so the hierarchy is obvious. */}
        <WithTooltip label={t('api_chat_history')}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleHistoryModal}
            className="text-muted-foreground hover:text-foreground gap-1.5"
            aria-label={t('api_chat_history')}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
          </Button>
        </WithTooltip>

        <WithTooltip label={t('api_chat_new_chat_tooltip')}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onNewChat}
            className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary gap-1.5 font-semibold shadow-none"
            aria-label={t('api_chat_new_chat_tooltip')}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('api_chat_new_chat')}</span>
          </Button>
        </WithTooltip>
      </div>
    </div>
  )
})

export default ChatHeader
