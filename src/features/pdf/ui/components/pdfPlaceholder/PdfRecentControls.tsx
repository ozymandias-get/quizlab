import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@app/components/ui/select'
import { WithTooltip } from '@app/components/ui/tooltip'

import type { TFunction } from 'i18next'
import { ArrowUpDown, History, Search, Trash2 } from 'lucide-react'
import { memo, useCallback } from 'react'

import type { SortMode } from './types'

interface PdfRecentControlsProps {
  t: TFunction
  recentCount: number
  shouldShowAdvancedControls: boolean
  searchQuery: string
  sortMode: SortMode
  isMobileSearchOpen: boolean
  canClear: boolean
  onSearchQueryChange: (searchQuery: string) => void
  onSortModeChange: (sortValue: SortMode) => void
  onToggleMobileSearch: () => void
  onClearAll: () => void
}

function PdfRecentControls({
  t,
  recentCount,
  shouldShowAdvancedControls,
  searchQuery,
  sortMode,
  isMobileSearchOpen,
  canClear,
  onSearchQueryChange,
  onSortModeChange,
  onToggleMobileSearch,
  onClearAll
}: PdfRecentControlsProps) {
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onSearchQueryChange(event.target.value),
    [onSearchQueryChange]
  )
  const handleSortChange = useCallback(
    (sortValue: string) => onSortModeChange(sortValue as SortMode),
    [onSortModeChange]
  )

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <History className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <h3 className="text-ql-13 text-foreground truncate font-semibold">
            {t('resume_reading')}
          </h3>
          {recentCount > 0 && (
            <span
              className="bg-muted text-muted-foreground text-ql-11 rounded-full px-1.5 tabular-nums"
              aria-label={t('recent_count_aria', { count: recentCount })}
            >
              {recentCount}
            </span>
          )}
        </div>
        {recentCount > 0 && canClear && (
          <WithTooltip label={t('clear_recent')}>
            <IconButton
              type="button"
              variant="ghost"
              size="compact"
              onClick={onClearAll}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/20"
              aria-label={t('clear_recent')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </WithTooltip>
        )}
      </div>

      {shouldShowAdvancedControls && recentCount > 0 && (
        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            variant="outline"
            size="compact"
            onClick={onToggleMobileSearch}
            className="text-muted-foreground sm:hidden"
            aria-label={t('search_recent')}
          >
            <Search className="h-3.5 w-3.5" />
          </IconButton>

          <div
            className={`${isMobileSearchOpen ? 'flex' : 'hidden'} text-ql-12 min-w-0 flex-1 sm:flex`}
          >
            <div className="relative w-full">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={t('search_recent_placeholder')}
                size="sm"
                className="pl-7"
                aria-label={t('search_recent')}
              />
            </div>
          </div>

          <Select value={sortMode} onValueChange={handleSortChange}>
            <SelectTrigger
              size="sm"
              className="border-border bg-background/50 text-foreground gap-1.5 pr-2 pl-6 [&_svg]:h-3.5 [&_svg]:w-3.5"
              aria-label={t('sort_recent_list')}
            >
              <ArrowUpDown className="text-muted-foreground pointer-events-none absolute left-2 h-3.5 w-3.5" />
              <span className="text-ql-12">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t('sort_recent')}</SelectItem>
              <SelectItem value="name">{t('sort_name')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}

export default memo(PdfRecentControls)
