import { usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'

import { EmptyState } from '@shared/ui/components/primitives'

import { History, Search } from 'lucide-react'
import { memo } from 'react'

import PdfRecentListItem from './PdfRecentListItem'
import type { RecentItemGroup, RecentItemView } from './types'

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
