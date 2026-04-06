import { useCallback } from 'react'
import { FileText, Play } from 'lucide-react'
import { Button } from '@ui/components/button'
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
      <div className="rounded-2xl border border-dashed border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent backdrop-blur-xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02),0_4px_16px_rgba(0,0,0,0.1)] p-4 text-left">
        <div className="text-sm font-semibold text-stone-300">{t('resume_empty_title')}</div>
        <p className="mt-1 text-xs text-stone-500">{t('resume_empty_desc')}</p>
      </div>
    )
  }

  if (processedCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent backdrop-blur-xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02),0_4px_16px_rgba(0,0,0,0.1)] p-4 text-left text-xs text-stone-400">
        {t('search_no_results')}
      </div>
    )
  }

  if (!canResume) {
    return null
  }

  return (
    <div className="max-h-[240px] sm:max-h-[300px] lg:max-h-[360px] overflow-y-auto custom-scrollbar pr-1 space-y-2 relative">
      {groupedItems.map((group) => (
        <div key={group.id} className="space-y-2">
          {group.labelKey && (
            <div className="px-1 text-[10px] uppercase tracking-[0.08em] text-stone-500">
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
              <div
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
                className={`
                                    group relative overflow-hidden w-full text-left rounded-2xl border px-3 py-2.5
                                    backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.2)]
                                    transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80
                                    ${
                                      isInvalid
                                        ? 'bg-red-500/[0.05] border-red-500/20 text-stone-300/80 hover:border-red-500/30'
                                        : 'bg-gradient-to-b from-white/[0.06] to-transparent border-white/5 text-stone-200 hover:border-white/15 hover:bg-white/5 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_12px_32px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0 before:absolute before:inset-0 before:z-0 before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700 before:ease-in-out'
                                    }
                                `}
                title={item.name}
              >
                <div className="relative z-10 flex items-center gap-3">
                  <div className="relative w-11 h-11 rounded-xl border border-white/10 overflow-hidden flex-shrink-0 bg-black/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/25 via-orange-400/10 to-sky-300/20" />
                    <FileText className="relative z-10 w-5 h-5 m-3 text-amber-300/80" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{item.name}</div>
                    <div
                      className={`mt-0.5 flex flex-wrap items-center gap-1 text-[11px] ${isInvalid ? 'text-red-200/80' : 'text-stone-400'}`}
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
                        className={`h-full rounded-full ${isInvalid ? 'bg-red-300/40' : 'bg-amber-300/45'}`}
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    {isInvalid && (
                      <div className="mt-1.5 text-[11px] text-red-200/80">
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
                      className="h-8 px-2.5 rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-stone-200 hover:border-amber-400/30 hover:bg-amber-500/10 hover:text-amber-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-all duration-300 ease-out active:scale-95"
                      aria-label={t('continue_reading')}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-xs">
                        {t('continue_reading_short')}
                      </span>
                    </Button>

                    {canClear && (
                      <button
                        type="button"
                        className="h-8 w-8 rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-stone-400 hover:border-red-500/30 hover:text-red-200 hover:bg-red-500/15 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-all duration-300 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/80"
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
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default PdfRecentList
