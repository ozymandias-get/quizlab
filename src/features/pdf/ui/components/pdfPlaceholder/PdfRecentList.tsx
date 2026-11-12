import { usePdfTabStore } from '@features/pdf/store/usePdfTabStore'

import { EmptyState } from '@shared/ui/components/primitives'

import { History, SearchX } from 'lucide-react'
import { memo } from 'react'

import PdfRecentListItem from './PdfRecentListItem'
import type { RecentItemGroup, RecentItemView } from './types'

interface PdfRecentListProps {
  t: (key: string, params?: Record<string, string>) => string
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
  /** Resets the search/filter that produced an empty result list. */
  onClearSearch?: () => void
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
  onRemove,
  onClearSearch
}: PdfRecentListProps) {
  const activePdfPath = usePdfTabStore((s) => {
    const activeTab = s.pdfTabs.find((tab) => tab.id === s.activePdfTabId)
    return activeTab?.kind === 'pdf' ? (activeTab.file?.path ?? undefined) : undefined
  })

  // The section fills the panel, so the empty states are centred in the space
  // it leaves rather than stranded at the top of a tall card.
  if (recentCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-6">
        <EmptyState
          icon={History}
          title={t('resume_empty_title')}
          description={t('resume_empty_desc')}
          size="sm"
          bare
        />
      </div>
    )
  }

  if (processedCount === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-6">
        <EmptyState
          icon={SearchX}
          title={t('search_no_results')}
          description={t('search_no_results_desc')}
          size="sm"
          bare
          action={
            onClearSearch ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="text-ql-12 text-primary focus-visible:ring-ring/70 rounded-md px-2 py-1 font-medium underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {t('clear_search')}
              </button>
            ) : undefined
          }
        />
      </div>
    )
  }

  if (!canResume) {
    return null
  }

  return (
    <div className="space-y-2">
      {groupedItems.map((group, groupIndex) => (
        <div key={group.id} className="space-y-2">
          {group.labelKey && (
            <div
              className={`text-ql-10 text-muted-foreground flex items-center gap-2 font-semibold uppercase ${groupIndex > 0 ? 'mt-3' : ''}`}
            >
              <span className="tracking-ql-label shrink-0">{t(group.labelKey)}</span>
              <span aria-hidden className="bg-border h-px flex-1" />
            </div>
          )}

          {group.items.map((item) => {
            const isInvalid = invalidPaths.has(item.path)

            return (
              <PdfRecentListItem
                key={item.path}
                item={item}
                activePdfPath={activePdfPath}
                isInvalid={isInvalid}
                t={t}
                language={language}
                onResume={onResume}
                onRelink={onRelink}
                onRemove={onRemove}
                canClear={canClear}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default memo(PdfRecentList)
