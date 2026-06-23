import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { Button } from '@app/components/ui/button'
import { EmptyState, IconBadge, ListItemCard } from '@shared/ui/components/primitives'

import { FileText, FolderOpen, History, Play, Search, Trash2 } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef
} from 'react'

import type { RecentItemGroup, RecentItemView } from './types'
import { formatRelativeTime, getProgressRatio } from './utils'

interface PdfRecentListProps {
  t: (key: string) => string
  language: string
  recentCount: number
  processedCount: number
  groupedItems: RecentItemGroup[]
  invalidPaths: Set<string>
  canResume: boolean
  canClear: boolean
  onResume: (item: RecentItemView) => Promise<void>
  onRelink?: (item: RecentItemView) => Promise<void>
  onRemove: (item: RecentItemView) => void
}

function PdfRecentList({
  t,
  language,
  recentCount,
  processedCount,
  groupedItems,
  invalidPaths,
  canResume,
  canClear,
  onResume,
  onRelink,
  onRemove
}: PdfRecentListProps) {
  const activePdfPath = usePdfTabStore((s) => {
    const activeTab = s.pdfTabs.find((tab) => tab.id === s.activePdfTabId)
    return activeTab?.kind === 'pdf' ? activeTab.file?.path : undefined
  })

  const resumeItem = useCallback(
    (item: RecentItemView) => {
      void onResume(item)['catch']((error: unknown) => {
        console.error('Failed to resume PDF:', item.path, error)
      })
    },
    [onResume]
  )

  const relinkItem = useCallback(
    (item: RecentItemView) => {
      void onRelink?.(item)
    },
    [onRelink]
  )

  // Refs + data-attribute delegation to avoid per-item inline closures
  // that would defeat ListItemCard's memo on every PdfRecentList re-render.
  const groupedItemsRef = useRef(groupedItems)
  groupedItemsRef.current = groupedItems

  const findItemByPath = useCallback((path: string): RecentItemView | undefined => {
    for (const group of groupedItemsRef.current) {
      const found = group.items.find((item) => item.path === path)
      if (found) return found
    }
    return undefined
  }, [])

  const handleCardClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const path = event.currentTarget.getAttribute('data-item-path')
      if (!path) return
      const item = findItemByPath(path)
      if (item) resumeItem(item)
    },
    [findItemByPath, resumeItem]
  )

  const handleCardKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const path = event.currentTarget.getAttribute('data-item-path')
      if (!path) return
      const item = findItemByPath(path)
      if (!item) return

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        resumeItem(item)
      }
      if (event.key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        onRemove(item)
      }
    },
    [findItemByPath, resumeItem, onRemove]
  )

  const handleButtonResume = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      const path = event.currentTarget.getAttribute('data-item-path')
      if (!path) return
      const item = findItemByPath(path)
      if (item) resumeItem(item)
    },
    [findItemByPath, resumeItem]
  )

  const handleButtonRelink = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      const path = event.currentTarget.getAttribute('data-item-path')
      if (!path) return
      const item = findItemByPath(path)
      if (item) relinkItem(item)
    },
    [findItemByPath, relinkItem]
  )

  const handleButtonRemove = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      const path = event.currentTarget.getAttribute('data-item-path')
      if (!path) return
      const item = findItemByPath(path)
      if (item) onRemove(item)
    },
    [findItemByPath, onRemove]
  )

  if (recentCount === 0) {
    return (
      <EmptyState
        icon={History}
        title={t('resume_empty_title')}
        description={t('resume_empty_desc')}
      />
    )
  }

  if (processedCount === 0) {
    return <EmptyState icon={Search} title={t('search_no_results')} />
  }

  if (!canResume) {
    return null
  }

  return (
    <div className="space-y-2">
      {groupedItems.map((group) => (
        <div key={group.id} className="space-y-2">
          {group.labelKey && (
            <div className="text-ql-10 tracking-ql-chrome px-1 text-stone-500 uppercase">
              {t(group.labelKey)}
            </div>
          )}

          {group.items.map((item) => {
            const pageMeta = `${t('page')} ${item.page}${item.totalPages ? ` / ${item.totalPages}` : ''}`
            const progress = getProgressRatio(item.page, item.totalPages)
            const openedMeta = item.lastOpenedAt
              ? formatRelativeTime(item.lastOpenedAt, language)
              : t('last_opened_unknown')
            const isInvalid = invalidPaths.has(item.path)

            return (
              <ListItemCard
                key={item.path}
                role="button"
                tabIndex={0}
                data-item-path={item.path}
                onClick={handleCardClick}
                onKeyDown={handleCardKeyDown}
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
                      <div className="text-ql-12 mt-1.5 text-red-200/80">
                        {t('recent_invalid_hint')}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {isInvalid && onRelink ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        data-item-path={item.path}
                        onClick={handleButtonRelink}
                        className="glass-tier-3 glass-interactive h-8 rounded-lg border-white/[0.1] px-2.5 text-stone-200 transition-colors transition-opacity duration-200 ease-out hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-100 active:scale-95 active:border-emerald-400/40 active:bg-emerald-500/15"
                        aria-label={t('choose_new_location')}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span className="text-ql-12 hidden sm:inline">
                          {t('choose_new_location_short')}
                        </span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        data-item-path={item.path}
                        onClick={handleButtonResume}
                        className="glass-tier-3 glass-interactive h-8 rounded-lg border-white/[0.1] px-2.5 text-stone-200 opacity-100 transition-colors transition-opacity duration-200 ease-out hover:border-amber-400/30 hover:bg-amber-500/10 hover:text-amber-100 active:scale-95 active:border-amber-400/40 active:bg-amber-500/15 md:opacity-[0.55] md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                        aria-label={t('continue_reading')}
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span className="text-ql-12 hidden sm:inline">
                          {t('continue_reading_short')}
                        </span>
                      </Button>
                    )}

                    {canClear && (
                      <button
                        type="button"
                        data-item-path={item.path}
                        onClick={handleButtonRemove}
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
          })}
        </div>
      ))}
    </div>
  )
}

export default memo(PdfRecentList)
