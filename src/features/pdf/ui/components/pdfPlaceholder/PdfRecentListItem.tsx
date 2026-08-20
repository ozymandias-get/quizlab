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
      e.stopPropagation()
      onRemove(item)
    },
    [item, onRemove]
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

  const handleClick = useCallback(() => {
    resumeItem()
  }, [resumeItem])

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

  const interactionProps = isInvalid
    ? {}
    : {
        role: 'button' as const,
        tabIndex: 0,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        'aria-label': `${t('continue_reading')}: ${item.name}`
      }

  return (
    <ListItemCard
      {...interactionProps}
      active={!!activePdfPath && item.path === activePdfPath}
      className={`pdf-recent-item group ${isInvalid ? 'border-destructive/30 bg-destructive/5 text-foreground border' : ''}`}
      interactive={!isInvalid}
    >
      <div className="relative z-10 flex w-full items-center gap-3">
        <IconBadge
          icon={FileText}
          variant={isInvalid ? 'danger' : 'warning'}
          size="md"
          className="shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-ql-13 text-foreground truncate font-semibold">{item.name}</span>
          </div>
          <div
            className={`text-ql-12 mt-0.5 flex flex-wrap items-center gap-1 ${isInvalid ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            <span>
              {t('resume_last_page')}: {pageMeta}
            </span>
            <span aria-hidden>&middot;</span>
            <span>
              {t('last_opened')}: {openedMeta}
            </span>
          </div>
          <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${isInvalid ? 'bg-destructive/50' : 'bg-primary/80'}`}
              style={{
                width: `${Number.isFinite(progress) ? Math.round(progress * 100) : 0}%`
              }}
            />
          </div>
          {isInvalid && (
            <div className="text-ql-12 text-destructive mt-1.5">{t('recent_invalid_hint')}</div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isInvalid && onRelink ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRelinkButtonClick}
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
              variant="outline"
              onClick={handleResumeButtonClick}
              className="text-foreground hover:border-ring/50 hover:bg-accent opacity-100 transition-opacity md:opacity-70 md:group-hover:opacity-100"
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
                variant="outline"
                size="compact"
                onClick={handleRemove}
                className="text-muted-foreground hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive opacity-100 md:opacity-70 md:group-hover:opacity-100"
                aria-label={t('remove_from_history')}
              >
                <Trash2 />
              </IconButton>
            </WithTooltip>
          )}
        </div>
      </div>
    </ListItemCard>
  )
}

export default memo(PdfRecentListItem)
