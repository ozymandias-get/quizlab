import { useQuickAiPresets } from '@features/ai'

import { Button } from '@app/components/ui/button'
import { cn } from '@shared/lib/uiUtils'

import {
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  X
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, type PointerEventHandler, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const [showPresetsMenu, setShowPresetsMenu] = useState(false)
  const presetsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showPresetsMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (presetsMenuRef.current && !presetsMenuRef.current.contains(e.target as Node)) {
        setShowPresetsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPresetsMenu])

  const { primaryPresets, secondaryPresets } = useQuickAiPresets()

  const handleSelectPreset = useCallback(
    (presetValue: string) => {
      setShowPresetsMenu(false)
      if (onSendWithPreset) {
        onSendWithPreset(presetValue)
      } else {
        onSend()
      }
    },
    [onSendWithPreset, onSend]
  )

  // Compact state: modern floating action toolbar
  if (!isExpanded) {
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

          {/* More Presets Dropdown */}
          <div ref={presetsMenuRef} className="relative shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setShowPresetsMenu((v) => !v)}
              disabled={isSubmitting || isSendDisabled}
              className={cn(
                'relative flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-neutral-400 shadow-2xs transition-all hover:border-white/20 hover:bg-white/[0.14] hover:text-white active:scale-95 disabled:opacity-40',
                showPresetsMenu && 'border-white/20 bg-white/[0.14] text-white'
              )}
              title={t('ai_preset_more')}
              aria-label={t('ai_preset_more')}
            >
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
            </button>

            <AnimatePresence>
              {showPresetsMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-xl border border-white/10 bg-[#16171b]/98 p-1 text-neutral-100 shadow-[0_20px_45px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
                >
                  <div className="text-ql-9 border-b border-white/10 px-2.5 py-1.5 font-semibold tracking-wider text-neutral-400 uppercase">
                    {t('ai_send_presets')}
                  </div>
                  <div className="flex flex-col gap-0.5 pt-1">
                    {secondaryPresets.map((preset) => {
                      const Icon = preset.icon
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectPreset(preset.value)
                          }}
                          className="text-ql-11 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-amber-300" strokeWidth={2} />
                          <span className="truncate">{preset.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
