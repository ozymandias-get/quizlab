import { Button } from '@app/components/ui/button'
import { Input } from '@app/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@app/components/ui/select'

import { ArrowUpDown, Search } from 'lucide-react'
import { memo, useCallback } from 'react'

import type { SortMode } from './types'

interface PdfRecentControlsProps {
  t: (key: string) => string
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
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 text-left">
          <h3 className="text-ql-14 text-foreground font-semibold">{t('resume_reading')}</h3>
          <p className="text-ql-12 text-muted-foreground mt-0.5">{t('resume_reading_desc')}</p>
        </div>
        {recentCount > 0 && canClear && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onClearAll}
            className="text-ql-12 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive h-7 rounded-md font-medium"
            aria-label={t('clear_recent')}
          >
            {t('clear_recent')}
          </Button>
        )}
      </div>

      {shouldShowAdvancedControls && recentCount > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMobileSearch}
              className="border-border bg-card text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none sm:hidden"
              aria-label={t('search_recent')}
            >
              <Search className="h-3.5 w-3.5" />
            </button>

            <label
              className={`${isMobileSearchOpen ? 'flex' : 'hidden'} border-border bg-card focus-within:border-ring focus-within:ring-ring/40 h-7 items-center gap-2 rounded-md border px-2.5 shadow-xs transition-colors focus-within:ring-1 sm:flex`}
            >
              <Search className="text-muted-foreground h-3.5 w-3.5" />
              <Input
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={t('search_recent_placeholder')}
                className="text-ql-12 h-auto w-36 border-none bg-transparent px-0 shadow-none sm:w-44"
                aria-label={t('search_recent')}
              />
            </label>
          </div>

          <Select value={sortMode} onValueChange={handleSortChange}>
            <SelectTrigger
              className="text-ql-12 border-border bg-card text-foreground hover:border-border hover:bg-muted h-7 gap-1 rounded-md border px-2 pl-7 shadow-xs"
              aria-label={t('sort_recent_list')}
            >
              <ArrowUpDown className="text-muted-foreground pointer-events-none absolute left-2 h-3.5 w-3.5" />
              <SelectValue />
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
