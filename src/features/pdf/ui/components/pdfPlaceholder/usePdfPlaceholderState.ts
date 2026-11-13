import type { LastReadingInfo, ResumePdfResult } from '@features/pdf/hooks/types'

import { useToastActions } from '@app/providers'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { groupRecentItems, processRecentItems } from './pdfPlaceholderUtils'
import type { RecentItemView, SortMode } from './types'

interface UsePdfPlaceholderStateParams {
  onResumePdf?: (path?: string) => Promise<ResumePdfResult> | ResumePdfResult
  onClearResumePdf?: (path?: string) => void
  onRestoreResumePdf?: (info: LastReadingInfo, index?: number) => void
  onRelinkPdf?: (oldPath: string) => Promise<boolean>
  lastReadingInfo?: LastReadingInfo[] | null
}

export function usePdfPlaceholderState({
  onResumePdf,
  onClearResumePdf,
  onRestoreResumePdf,
  onRelinkPdf,
  lastReadingInfo
}: UsePdfPlaceholderStateParams) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const { addToast } = useToastActions()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [invalidPaths, setInvalidPaths] = useState<Set<string>>(new Set())
  const emptyItemsRef = useRef<LastReadingInfo[]>([])
  const recentItems = lastReadingInfo ?? emptyItemsRef.current
  const recentItemViewsRef = useRef<RecentItemView[]>([])

  useEffect(() => {
    setInvalidPaths((prev) => {
      if (prev.size === 0) return prev
      const validPaths = new Set(recentItems.map((item) => item.path))
      const next = new Set<string>()
      let changed = false
      for (const path of prev) {
        if (validPaths.has(path)) next.add(path)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [recentItems])

  const recentItemsWithIndex = useMemo<RecentItemView[]>(() => {
    const previousByPath = new Map(recentItemViewsRef.current.map((item) => [item.path, item]))
    const next = recentItems.map((item, originalIndex) => {
      const previous = previousByPath.get(item.path)
      // Keep the object identity when only other history entries changed, so
      // memoised rows for untouched PDFs can bail out.
      if (
        previous &&
        previous.originalIndex === originalIndex &&
        previous.name === item.name &&
        previous.page === item.page &&
        previous.totalPages === item.totalPages &&
        previous.lastOpenedAt === item.lastOpenedAt
      ) {
        return previous
      }
      return { ...item, originalIndex }
    })
    recentItemViewsRef.current = next
    return next
  }, [recentItems])

  const processedItems = useMemo(
    () => processRecentItems(recentItemsWithIndex, searchQuery, sortMode, language),
    [recentItemsWithIndex, searchQuery, sortMode, language]
  )

  const groupedItems = useMemo(() => groupRecentItems(processedItems), [processedItems])

  const handleResume = useCallback(
    async (item: RecentItemView) => {
      if (!onResumePdf) return
      const result = await onResumePdf(item.path)

      setInvalidPaths((prev) => {
        const next = new Set(prev)
        if (result === 'not_found') next.add(item.path)
        if (result === 'success') next.delete(item.path)
        return next
      })
    },
    [onResumePdf]
  )

  const handleRelink = useCallback(
    async (item: RecentItemView) => {
      if (!onRelinkPdf) return
      const success = await onRelinkPdf(item.path)
      if (success) {
        setInvalidPaths((prev) => {
          const next = new Set(prev)
          next.delete(item.path)
          return next
        })
      }
    },
    [onRelinkPdf]
  )

  const handleRemove = useCallback(
    (item: RecentItemView) => {
      if (!onClearResumePdf) return

      onClearResumePdf(item.path)
      setInvalidPaths((prev) => {
        const next = new Set(prev)
        next.delete(item.path)
        return next
      })

      addToast({
        type: 'info',
        message: 'recent_entry_removed',
        params: { fileName: item.name },
        duration: 7000,
        ...(onRestoreResumePdf
          ? {
              actionLabel: 'undo',
              onAction: () => onRestoreResumePdf(item, item.originalIndex)
            }
          : {})
      })
    },
    [addToast, onClearResumePdf, onRestoreResumePdf]
  )

  const handleClearAll = useCallback(() => {
    if (!onClearResumePdf) return
    onClearResumePdf()
    setInvalidPaths(new Set<string>())
    addToast({ type: 'info', message: 'recent_list_cleared' })
  }, [addToast, onClearResumePdf])

  const toggleMobileSearch = useCallback(() => {
    setIsMobileSearchOpen((prev) => !prev)
  }, [])

  return {
    t,
    language,
    recentItems,
    processedItems,
    groupedItems,
    invalidPaths,
    searchQuery,
    sortMode,
    isMobileSearchOpen,
    shouldShowAdvancedControls:
      recentItems.length > 6 || searchQuery.length > 0 || sortMode !== 'recent',
    setSearchQuery,
    setSortMode,
    toggleMobileSearch,
    handleResume,
    handleRelink,
    handleRemove,
    handleClearAll
  }
}
