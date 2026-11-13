import { BlurFade } from '@app/components/ui/blur-fade'
import { MagicCard } from '@app/components/ui/magic-card'
import { Logger } from '@shared/lib/logger'
import {
  Button,
  IconBadge,
  IconButton,
  ListItemCard,
  WithTooltip
} from '@shared/ui/components/primitives'

import { FileText, FolderOpen, Play, Trash2 } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback
} from 'react'

import { formatRelativeTime, getProgressRatio } from './pdfPlaceholderUtils'
import type { RecentItemView } from './types'

interface PdfRecentListItemProps {
  item: RecentItemView
  activePdfPath: string | undefined
  isInvalid: boolean
  t: (key: string, params?: Record<string, string>) => string
  language: string
  onResume: (item: RecentItemView) => Promise<void>
  onRelink?: (item: RecentItemView) => Promise<void>
  onRemove: (item: RecentItemView) => void
  canClear: boolean
}

function PdfRecentListItem({
  item,
  activePdfPath,
  isInvalid,
  t,
  language,
  onResume,
  onRelink,
  onRemove,
  canClear
}: PdfRecentListItemProps) {
  const resumeItem = useCallback(() => {
    void onResume(item)['catch']((error: unknown) => {
      Logger.error('Failed to resume PDF:', item.path, error)
    })
  }, [item, onResume])

  const relinkItem = useCallback(() => {
    void onRelink?.(item)
  }, [item, onRelink])

  const handleRemove = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      // Radix TooltipTrigger asChild clone may still bubble via native event
      const native = e.nativeEvent as unknown as { stopImmediatePropagation?: () => void }
      native.stopImmediatePropagation?.()
      onRemove(item)
    },
    [item, onRemove]
  )

  const handleRemovePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
  }, [])

  const handleCardClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      // Guard: ignore clicks that originated from a button (delete/relink/resume)
      if ((e.target as HTMLElement).closest('button')) return
      resumeItem()
    },
    [resumeItem]
  )

  const handleResumeButtonClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      resumeItem()
    },
    [resumeItem]
  )

  const handleRelinkButtonClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      relinkItem()
    },
    [relinkItem]
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        resumeItem()
      }
      if (event.key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        onRemove(item)
      }
    },
    [resumeItem, item, onRemove]
  )

  const pageMeta = `${t('page')} ${item.page}${item.totalPages ? ` / ${item.totalPages}` : ''}`
  const progress = getProgressRatio(item.page, item.totalPages)
  const progressPercent = Math.round(progress * 100)
  const openedMeta = item.lastOpenedAt
    ? formatRelativeTime(item.lastOpenedAt, language)
    : t('last_opened_unknown')
  const showProgress = !isInvalid && item.totalPages > 0 && Number.isFinite(progress)
  const isActive = !!activePdfPath && item.path === activePdfPath

  const interactionProps = isInvalid
    ? {}
    : {
        role: 'button' as const,
        tabIndex: 0,
        onClick: handleCardClick,
        onKeyDown: handleKeyDown,
        'aria-label': `${t('continue_reading')}: ${item.name}`
      }

  return (
    <BlurFade className="w-full">
      <MagicCard
        className={`w-full rounded-xl border-white/[0.07] ${isActive ? 'ring-ring/30 ring-1' : ''}`}
        gradientColor="#18181b"
        gradientOpacity={0.35}
        gradientFrom="#27272a"
        gradientTo="#18181b"
      >
        <ListItemCard
          active={isActive}
          className={`group relative border-0 bg-transparent p-0 shadow-none hover:bg-white/[0.03] ${isInvalid ? 'text-foreground border-destructive/30 bg-destructive/5' : ''}`}
          interactive={false}
        >
          {isActive && (
            <span
              aria-hidden
              className="motion-slow absolute inset-y-2 left-0 w-0.5 rounded-full"
              style={{ backgroundColor: 'var(--selection-color-source, oklch(var(--ring)))' }}
            />
          )}

          <div className="flex w-full items-center gap-3 p-3">
            {/* The clickable area is a sibling of the action buttons, not their
                ancestor: no interactive control is nested inside role=button. */}
            <div
              {...interactionProps}
              className={`pdf-recent-item flex min-w-0 flex-1 items-center gap-3 rounded-lg ${
                isInvalid
                  ? ''
                  : 'focus-visible:ring-ring/70 cursor-pointer focus-visible:ring-2 focus-visible:outline-none'
              }`}
            >
              <IconBadge
                icon={FileText}
                variant={isInvalid ? 'danger' : isActive ? 'primary' : 'ghost'}
                size="md"
                className="shrink-0"
              />

              <div className="min-w-0 flex-1">
                <div className="text-ql-13 text-foreground truncate font-semibold">{item.name}</div>
                <div
                  className={`text-ql-12 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-normal ${isInvalid ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {showProgress ? (
                    <span
                      className="text-ql-10 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-semibold text-zinc-400 tabular-nums"
                      data-testid="pdf-recent-progress-label"
                    >
                      {t('pdf_page_progress', {
                        page: String(item.page),
                        total: String(item.totalPages),
                        percent: String(progressPercent)
                      })}
                    </span>
                  ) : (
                    <span>{pageMeta}</span>
                  )}
                  <span aria-hidden>&middot;</span>
                  <span>{openedMeta}</span>
                </div>
                {isInvalid && (
                  <div className="text-ql-12 text-destructive mt-1.5">
                    {t('recent_invalid_hint')}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {isInvalid ? (
                onRelink ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRelinkButtonClick}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                    aria-label={t('choose_new_location')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span className="text-ql-12 hidden sm:inline">
                      {t('choose_new_location_short')}
                    </span>
                  </Button>
                ) : null
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleResumeButtonClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground size-8 shrink-0 p-0"
                  aria-label={t('continue_reading')}
                  title={t('continue_reading')}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              )}

              {canClear && (
                <WithTooltip label={t('remove_from_history')}>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="compact"
                    onClick={handleRemove}
                    onPointerDown={handleRemovePointerDown}
                    onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                    className="text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/20 opacity-60 transition-all hover:opacity-100 focus-visible:opacity-100 md:opacity-60 md:group-hover:hover:opacity-100"
                    aria-label={t('remove_from_history')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </WithTooltip>
              )}
            </div>
          </div>
        </ListItemCard>
      </MagicCard>
    </BlurFade>
  )
}

export default memo(PdfRecentListItem)
