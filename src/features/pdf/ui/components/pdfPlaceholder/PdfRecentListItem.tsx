import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { Logger } from '@shared/lib/logger'
import { IconBadge, ListItemCard } from '@shared/ui/components/primitives'

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
  t: (key: string) => string
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
    <ListItemCard
      {...interactionProps}
      active={isActive}
      className={`pdf-recent-item group relative p-0 ${isActive ? 'ring-ring/20 ring-1' : ''} ${isInvalid ? 'border-destructive/30 bg-destructive/5 text-foreground' : ''}`}
      interactive={!isInvalid}
    >
      {isActive && (
        <span
          aria-hidden
          className="bg-ring motion-slow absolute inset-y-2 left-0 w-0.5 rounded-full"
        />
      )}

      <div className="flex w-full items-center gap-3 p-3">
        <IconBadge
          icon={FileText}
          variant={isInvalid ? 'danger' : isActive ? 'primary' : 'ghost'}
          size="md"
          className="shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="text-ql-13 text-foreground truncate font-semibold">{item.name}</div>
          <div
            className={`text-ql-12 mt-0.5 flex flex-wrap items-center gap-x-1.5 font-normal ${isInvalid ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            <span>{pageMeta}</span>
            <span aria-hidden>&middot;</span>
            <span>{openedMeta}</span>
          </div>
          {showProgress && (
            <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
              <div
                className="bg-primary/70 h-full rounded-full"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
          {isInvalid && (
            <div className="text-ql-12 text-destructive mt-1.5">{t('recent_invalid_hint')}</div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isInvalid && onRelink ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRelinkButtonClick}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
              aria-label={t('choose_new_location')}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="text-ql-12 hidden sm:inline">{t('choose_new_location_short')}</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleResumeButtonClick}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t('continue_reading')}
            >
              <Play className="h-3.5 w-3.5" />
              <span className="text-ql-12 hidden sm:inline">{t('continue_reading_short')}</span>
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
                className="text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/20 opacity-60 transition-all hover:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-60 md:group-hover:hover:opacity-100"
                aria-label={t('remove_from_history')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </WithTooltip>
          )}
        </div>
      </div>
    </ListItemCard>
  )
}

export default memo(PdfRecentListItem)
