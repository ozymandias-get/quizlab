import { Button } from '@app/components/ui/button'

import { ChevronDown, Loader2, Send, Trash2 } from 'lucide-react'
import { memo, type PointerEventHandler } from 'react'
import { useTranslation } from 'react-i18next'

import CompactComposerBar from './CompactComposerBar'
import type { SendFeedback } from './types'

interface AiSendComposerHeaderProps {
  textCount: number
  imageCount: number
  autoSend: boolean
  isExpanded: boolean
  sendFeedback: SendFeedback
  onToggleExpand: () => void
  onClearAll: () => void
  onSend: () => void
  onSendWithPreset?: (presetValue: string) => void
  isSubmitting: boolean
  isSendDisabled: boolean
  onDragStart: PointerEventHandler<HTMLDivElement>
  onDragMove: PointerEventHandler<HTMLDivElement>
  onDragEnd: PointerEventHandler<HTMLDivElement>
  onDragLostCapture: PointerEventHandler<HTMLDivElement>
}

function AiSendComposerHeader({
  textCount,
  imageCount,
  autoSend,
  isExpanded,
  sendFeedback,
  onToggleExpand,
  onClearAll,
  onSend,
  onSendWithPreset,
  isSubmitting,
  isSendDisabled,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragLostCapture
}: AiSendComposerHeaderProps) {
  const { t } = useTranslation()
  const isSending = sendFeedback === 'sending'

  // Compact state: modern floating action toolbar
  if (!isExpanded) {
    return (
      <CompactComposerBar
        autoSend={autoSend}
        isSending={isSending}
        isSubmitting={isSubmitting}
        isSendDisabled={isSendDisabled}
        onToggleExpand={onToggleExpand}
        onClearAll={onClearAll}
        onSend={onSend}
        onSendWithPreset={onSendWithPreset}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragLostCapture={onDragLostCapture}
      />
    )
  }

  // Expanded state: full header
  const summaryParts: string[] = []
  if (textCount > 0) summaryParts.push(`${textCount} ${t('ai_send_text_count_label')}`)
  if (imageCount > 0) summaryParts.push(`${imageCount} ${t('ai_send_image_count_label')}`)
  const summary = summaryParts.join(' · ')

  return (
    <div
      className="border-border relative cursor-grab touch-none border-b px-4 py-3 select-none active:cursor-grabbing"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onLostPointerCapture={onDragLostCapture}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="border-primary/20 bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-xs">
            <Send className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-ql-13 text-foreground truncate font-semibold">
              {t('ai_send_panel_title')}
            </p>
            {summary && !isSending && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-ql-11 text-muted-foreground font-medium">{summary}</span>
              </div>
            )}
            {isSending && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <Loader2 className="text-primary h-3 w-3 animate-spin" strokeWidth={2} />
                <span className="text-ql-11 text-muted-foreground font-medium">
                  {t('sending_to_ai')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-7 w-7 shrink-0 rounded-md transition-colors"
            title={t('ai_send_clear_all')}
            aria-label={t('ai_send_clear_all')}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleExpand}
            className="text-muted-foreground hover:bg-muted hover:text-foreground h-7 w-7 shrink-0 rounded-md transition-colors"
            title={t('ai_send_collapse')}
            aria-label={t('ai_send_collapse')}
            aria-expanded={isExpanded}
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default memo(AiSendComposerHeader)
