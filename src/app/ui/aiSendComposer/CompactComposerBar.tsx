import { useQuickAiPresets } from '@features/ai'

import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'

import { Loader2, Pencil, Send, Sparkles, X } from 'lucide-react'
import { memo, type PointerEventHandler, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import CompactPresetsMenu from './CompactPresetsMenu'

interface CompactComposerBarProps {
  autoSend: boolean
  isSending: boolean
  isSubmitting: boolean
  isSendDisabled: boolean
  onToggleExpand: () => void
  onClearAll: () => void
  onSend: () => void
  onSendWithPreset?: (presetValue: string) => void
  onDragStart: PointerEventHandler<HTMLDivElement>
  onDragMove: PointerEventHandler<HTMLDivElement>
  onDragEnd: PointerEventHandler<HTMLDivElement>
  onDragLostCapture: PointerEventHandler<HTMLDivElement>
}

function CompactComposerBar({
  autoSend,
  isSending,
  isSubmitting,
  isSendDisabled,
  onToggleExpand,
  onClearAll,
  onSend,
  onSendWithPreset,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragLostCapture
}: CompactComposerBarProps) {
  const { t } = useTranslation()
  const { primaryPresets, secondaryPresets } = useQuickAiPresets()

  const handleSelectPreset = useCallback(
    (presetValue: string) => {
      if (onSendWithPreset) {
        onSendWithPreset(presetValue)
      } else {
        onSend()
      }
    },
    [onSendWithPreset, onSend]
  )

  if (isSending) {
    return (
      <div
        className="flex h-11 w-max cursor-grab touch-none items-center justify-between gap-3 px-3 py-1.5 text-white select-none active:cursor-grabbing"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onLostPointerCapture={onDragLostCapture}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.08] text-amber-300 shadow-2xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col">
            <span className="text-ql-11 font-semibold text-white">{t('sending_to_ai')}</span>
            <span className="text-ql-9 font-medium text-neutral-400">
              {t('ai_send_sending_subtitle')}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClearAll}
          className="h-7 w-7 shrink-0 rounded-lg text-neutral-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
          title={t('ai_send_clear_all')}
          aria-label={t('ai_send_clear_all')}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </Button>
      </div>
    )
  }

  return (
    <div
      className="flex h-11 w-max cursor-grab touch-none items-center justify-between gap-1.5 px-2.5 py-1.5 text-white select-none active:cursor-grabbing"
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onLostPointerCapture={onDragLostCapture}
    >
      {/* Brand AI Icon */}
      <div className="flex shrink-0 items-center">
        <div
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.08] text-amber-300 shadow-2xs"
          title={autoSend ? t('ai_send_mode_auto') : 'QuizLab AI'}
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
          {autoSend && (
            <span
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-xs ring-2 ring-[#0f1013]"
              title={t('ai_send_mode_auto')}
            />
          )}
        </div>
      </div>

      {/* Primary Action Option Buttons (Seçenekler) */}
      <div className="flex shrink-0 items-center gap-1">
        {primaryPresets.map((preset) => {
          const Icon = preset.icon
          return (
            <button
              key={preset.key}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => handleSelectPreset(preset.value)}
              disabled={isSubmitting || isSendDisabled}
              className={cn(
                'group/btn text-ql-11 relative flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 font-medium text-neutral-200 shadow-2xs transition-all outline-none hover:border-white/20 hover:bg-white/[0.14] hover:text-white focus-visible:ring-2 focus-visible:ring-white/30 active:scale-95 disabled:pointer-events-none disabled:opacity-40'
              )}
              title={preset.value}
            >
              <Icon
                className="h-3 w-3 shrink-0 text-amber-300 transition-transform group-hover/btn:scale-110"
                strokeWidth={2.2}
              />
              <span className="whitespace-nowrap">{preset.label}</span>
            </button>
          )
        })}

        <CompactPresetsMenu
          secondaryPresets={secondaryPresets}
          onSelectPreset={handleSelectPreset}
          disabled={isSubmitting || isSendDisabled}
        />
      </div>

      {/* Divider */}
      <div className="mx-0.5 h-4 w-px shrink-0 bg-white/15" />

      {/* Right Tools: Expand/Note, Direct Send, Dismiss */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleExpand}
          disabled={isSubmitting}
          className="h-7 w-7 shrink-0 rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          title={t('ai_send_custom_note')}
          aria-label={t('ai_send_custom_note')}
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
        </Button>

        <Button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onSend}
          disabled={isSubmitting || isSendDisabled}
          className={cn(
            'text-ql-11 h-7 shrink-0 rounded-lg border border-white/20 bg-white px-2.5 font-semibold text-neutral-950 shadow-xs transition-all hover:bg-neutral-200 active:scale-95 disabled:opacity-40',
            isSubmitting && 'pointer-events-none'
          )}
          aria-label={t('send_to_ai')}
        >
          <Send className="mr-1 h-3 w-3" strokeWidth={2.2} />
          <span>{t('send_to_ai')}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClearAll}
          className="h-7 w-7 shrink-0 rounded-lg text-neutral-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
          title={t('ai_send_clear_all')}
          aria-label={t('ai_send_clear_all')}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </Button>
      </div>
    </div>
  )
}

export default memo(CompactComposerBar)
