import { useQuickAiPresets } from '@features/ai'

import { cn } from '@shared/lib/uiUtils'
import { Button, IconButton, WithTooltip } from '@shared/ui/components/primitives'

import { Loader2, Pencil, Send, Sparkles, X } from 'lucide-react'
import { memo, type PointerEventHandler, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import CompactPresetsMenu from './CompactPresetsMenu'

/* Chip recipe shared by the auto-send toggle and the preset buttons, so the
   two never drift. Surfaces come from theme tokens — the bar is a floating
   overlay, but it still has to stay legible when the app is in light mode.
   The preset chips keep their border transparent at rest: three bordered pills
   side by side was the busiest thing on the bar. The border arrives on hover,
   where it does useful work as a focus cue.

   `CHIP_DANGER` mirrors `CHIP_BORDERED` so the leading and trailing edge
   controls carry the same visual weight. With a bare ghost X on the right and
   a filled chip on the left, the pill read as lopsided — the right-hand gap
   looked far wider than the left even though `px-3` was symmetric. */
const CHIP_IDLE =
  'border-transparent bg-background/40 text-foreground hover:border-ring/40 hover:bg-muted'
const CHIP_BORDERED =
  'border-border/60 bg-background/40 text-foreground hover:border-ring/40 hover:bg-muted'
const CHIP_ACTIVE = 'border-ring/50 bg-accent text-foreground'
const CHIP_DANGER =
  'border-border/60 bg-background/40 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive'

const BAR_LAYOUT =
  'flex h-13 w-max cursor-grab touch-none items-center gap-2 px-3 py-2 select-none active:cursor-grabbing'

interface CompactComposerBarProps {
  autoSend: boolean
  onToggleAutoSend?: () => void
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
  onToggleAutoSend,
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
        className={`${BAR_LAYOUT} gap-3.5 px-3.5`}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onLostPointerCapture={onDragLostCapture}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="border-border/60 bg-muted text-primary flex size-8 shrink-0 items-center justify-center rounded-lg border"
            aria-hidden
          >
            <Loader2 className="size-4 animate-spin" />
          </div>
          <div className="flex flex-col">
            <span className="text-ql-12 text-foreground font-semibold">{t('sending_to_ai')}</span>
            <span className="text-ql-11 text-muted-foreground">
              {t('ai_send_sending_subtitle')}
            </span>
          </div>
        </div>

        <WithTooltip label={t('ai_send_clear_all')}>
          <IconButton
            variant="ghost"
            size="default"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('ai_send_clear_all')}
          >
            <X strokeWidth={2} />
          </IconButton>
        </WithTooltip>
      </div>
    )
  }

  return (
    <div
      className={BAR_LAYOUT}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onLostPointerCapture={onDragLostCapture}
    >
      {/* Auto-Send Toggle Button */}
      <div className="flex shrink-0 items-center">
        <WithTooltip label={autoSend ? t('auto_send_on') : t('auto_send_off')}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleAutoSend}
            disabled={isSubmitting}
            className={cn(
              'motion-normal focus-visible:ring-ring/40 group relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40',
              autoSend ? CHIP_ACTIVE : CHIP_BORDERED
            )}
            aria-label={autoSend ? t('auto_send_on') : t('auto_send_off')}
            aria-pressed={autoSend}
          >
            <Sparkles className="motion-slow size-4 transition-transform group-hover:scale-110" />
            <span
              aria-hidden
              className={cn(
                'ring-card absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2',
                autoSend ? 'bg-emerald-500' : 'bg-muted-foreground/50'
              )}
            />
          </button>
        </WithTooltip>
      </div>

      {/* Primary Action Option Buttons (Seçenekler) */}
      <div className="flex shrink-0 items-center gap-1">
        {primaryPresets.map((preset) => {
          const Icon = preset.icon
          return (
            <WithTooltip key={preset.key} label={preset.value}>
              <Button
                type="button"
                size="default"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleSelectPreset(preset.value)}
                disabled={isSubmitting || isSendDisabled}
                className={cn('group/btn motion-normal relative px-3', CHIP_IDLE)}
              >
                <Icon className="text-muted-foreground motion-slow group-hover/btn:text-foreground size-3.5 shrink-0 transition-transform group-hover/btn:scale-110" />
                <span className="text-ql-12 font-medium whitespace-nowrap">{preset.label}</span>
              </Button>
            </WithTooltip>
          )
        })}

        <CompactPresetsMenu
          secondaryPresets={secondaryPresets}
          onSelectPreset={handleSelectPreset}
          disabled={isSubmitting || isSendDisabled}
        />
      </div>

      {/* Divider — no `mx`: the shell's `gap-2` already spaces it, and the
          extra margin made it sit further from the send group than from the
          preset group. */}
      <div className="bg-border h-5 w-px shrink-0" />

      {/* Right Tools: Expand/Note, Direct Send, Dismiss */}
      <div className="flex shrink-0 items-center gap-1">
        <WithTooltip label={t('ai_send_custom_note')}>
          <IconButton
            variant="ghost"
            size="default"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleExpand}
            disabled={isSubmitting}
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('ai_send_custom_note')}
          >
            <Pencil className="size-3.5" strokeWidth={2} />
          </IconButton>
        </WithTooltip>

        <Button
          type="button"
          size="default"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onSend}
          disabled={isSubmitting || isSendDisabled}
          className="h-8 shrink-0 px-3"
          aria-label={t('send_to_ai')}
        >
          <Send className="mr-1.5 size-3.5" />
          <span className="text-ql-12 font-semibold">{t('send_to_ai')}</span>
        </Button>

        <WithTooltip label={t('ai_send_clear_all')}>
          <IconButton
            variant="ghost"
            size="default"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClearAll}
            className={CHIP_DANGER}
            aria-label={t('ai_send_clear_all')}
          >
            <X strokeWidth={2} />
          </IconButton>
        </WithTooltip>
      </div>
    </div>
  )
}

export default memo(CompactComposerBar)
