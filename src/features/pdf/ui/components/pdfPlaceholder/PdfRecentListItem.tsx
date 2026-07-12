import { Button } from '@app/components/ui/button'
import { Logger } from '@shared/lib/logger'
import { IconBadge, ListItemCard } from '@shared/ui/components/primitives'

import { FileText, FolderOpen, Play, Trash2 } from 'lucide-react'
import { memo, type MouseEvent as ReactMouseEvent, useCallback } from 'react'

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

  const handleClick = useCallback(() => {
    resumeItem()
  }, [resumeItem])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
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

  return (
    <ListItemCard
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${t('continue_reading')}: ${item.name}`}
      title={item.name}
      active={!!activePdfPath && item.path === activePdfPath}
      className={`pdf-recent-item group ${isInvalid ? 'border border-red-500/20 bg-red-500/[0.05] text-stone-300/80 hover:border-red-500/30' : ''}`}
      interactive={!isInvalid}
    >
      <div className="relative z-10 flex w-full items-center gap-3">
        <IconBadge
          icon={FileText}
          variant={isInvalid ? 'danger' : 'warning'}
          size="lg"
          className="shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-ql-16 truncate font-semibold">{item.name}</span>
          </div>
          <div
            className={`text-ql-12 mt-0.5 flex flex-wrap items-center gap-1 ${isInvalid ? 'text-red-200/80' : 'text-stone-400'}`}
          >
            <span>
              {t('resume_last_page')}: {pageMeta}
            </span>
            <span aria-hidden>&middot;</span>
            <span>
              {t('last_opened')}: {openedMeta}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${isInvalid ? 'bg-red-500/40' : 'bg-amber-400/80'}`}
              style={{
                width: `${Number.isFinite(progress) ? Math.round(progress * 100) : 0}%`
              }}
            />
          </div>
          {isInvalid && (
            <div className="text-ql-12 mt-1.5 text-red-200/80">{t('recent_invalid_hint')}</div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isInvalid && onRelink ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={relinkItem}
              className="glass-tier-3 glass-interactive h-8 rounded-lg border-white/[0.1] px-2.5 text-stone-200 transition-colors transition-opacity duration-200 ease-out hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-100 active:scale-95 active:border-emerald-400/40 active:bg-emerald-500/15"
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
              onClick={resumeItem}
              className="glass-tier-3 glass-interactive h-8 rounded-lg border-white/[0.1] px-2.5 text-stone-200 opacity-100 transition-colors transition-opacity duration-200 ease-out hover:border-amber-400/30 hover:bg-amber-500/10 hover:text-amber-100 active:scale-95 active:border-amber-400/40 active:bg-amber-500/15 md:opacity-[0.55] md:group-focus-within:opacity-100 md:group-hover:opacity-100"
              aria-label={t('continue_reading')}
            >
              <Play className="h-3.5 w-3.5" />
              <span className="text-ql-12 hidden sm:inline">{t('continue_reading_short')}</span>
            </Button>
          )}

          {canClear && (
            <button
              type="button"
              onClick={handleRemove}
              className="glass-tier-3 glass-interactive h-8 w-8 rounded-lg border-white/[0.1] text-stone-400 opacity-100 transition-colors duration-300 ease-out hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-200 focus-visible:ring-2 focus-visible:ring-red-400/80 focus-visible:outline-none active:scale-95 active:border-red-500/40 active:bg-red-500/20 md:opacity-[0.55] md:group-focus-within:opacity-100 md:group-hover:opacity-100"
              aria-label={t('remove_from_history')}
              title={t('remove_from_history')}
            >
              <Trash2 className="mx-auto h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </ListItemCard>
  )
}

export default memo(PdfRecentListItem)
