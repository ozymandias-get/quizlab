import { useCallback } from 'react'
import { FileText, Play, Search, History } from 'lucide-react'
import { Button } from '@ui/components/button'
import type { RecentItemGroup, RecentItemView } from './types'
import { formatRelativeTime, getProgressRatio } from './utils'
import { EmptyState, ListItemCard, IconBadge } from '@shared/ui/components/primitives'

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
  onRemove
}: PdfRecentListProps) {
  const resumeItem = useCallback(
    (item: RecentItemView) => {
      void onResume(item)
    },
    [onResume]
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
    <div className="max-h-[240px] sm:max-h-[300px] lg:max-h-[360px] overflow-y-auto custom-scrollbar pr-1 space-y-2 relative">
      {groupedItems.map((group) => (
        <div key={group.id} className="space-y-2">
          {group.labelKey && (
            <div className="px-1 text-ql-10 uppercase tracking-ql-chrome text-stone-500">
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
                onClick={() => resumeItem(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    resumeItem(item)
                  }
                  if (event.key === 'Delete') {
                    event.preventDefault()
                    event.stopPropagation()
                    onRemove(item)
                  }
                }}
                aria-label={`${t('continue_reading')}: ${item.name}`}
                title={item.name}
                className={`group ${isInvalid ? 'bg-red-500/[0.05] border border-red-500/20 text-stone-300/80 hover:border-red-500/30' : ''}`}
                interactive={!isInvalid}
              >
                <div className="relative z-10 flex items-center gap-3 w-full">
                  <IconBadge
                    icon={FileText}
                    variant={isInvalid ? 'danger' : 'warning'}
                    size="lg"
                    className="flex-shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-ql-16 font-semibold">{item.name}</div>
                    <div
                      className={`mt-0.5 flex flex-wrap items-center gap-1 text-ql-12 ${isInvalid ? 'text-red-200/80' : 'text-stone-400'}`}
                    >
                      <span>
                        {t('resume_last_page')}: {pageMeta}
                      </span>
                      <span aria-hidden>&middot;</span>
                      <span>
                        {t('last_opened')}: {openedMeta}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isInvalid ? 'bg-red-500/40' : 'bg-amber-400/80'}`}
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    {isInvalid && (
                      <div className="mt-1.5 text-ql-12 text-red-200/80">
                        {t('recent_invalid_hint')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        resumeItem(item)
                      }}
                      className="h-8 px-2.5 rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-stone-200 hover:border-amber-400/30 hover:bg-amber-500/10 hover:text-amber-100 opacity-100 md:opacity-[0.55] md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-all duration-300 ease-out active:scale-95"
                      aria-label={t('continue_reading')}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-ql-12">
                        {t('continue_reading_short')}
                      </span>
                    </Button>

                    {canClear && (
                      <button
                        type="button"
                        className="h-8 w-8 rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-stone-400 hover:border-red-500/30 hover:text-red-200 hover:bg-red-500/15 opacity-100 md:opacity-[0.55] md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-all duration-300 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/80"
                        onClick={(event) => {
                          event.stopPropagation()
                          onRemove(item)
                        }}
                        aria-label={t('remove_from_history')}
                        title={t('remove_from_history')}
                      >
                        <svg
                          className="w-4 h-4 mx-auto"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
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

export default PdfRecentList
