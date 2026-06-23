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
          <h3 className="text-ql-14 font-semibold text-stone-200">{t('resume_reading')}</h3>
          <p className="text-ql-12 mt-0.5 text-stone-500">{t('resume_reading_desc')}</p>
        </div>
        {recentCount > 0 && canClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-ql-12 h-8 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent px-3 font-medium tracking-wide text-stone-300/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-md transition-colors transition-shadow duration-200 ease-out hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200 hover:shadow-[0_4px_16px_rgba(239,68,68,0.15)] active:scale-95"
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
              className="h-8 w-8 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent text-stone-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-md transition-colors transition-shadow duration-200 ease-out hover:border-white/20 hover:bg-white/10 hover:text-stone-100 hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none active:scale-95 sm:hidden"
              aria-label={t('search_recent')}
            >
              <Search className="mx-auto h-4 w-4" />
            </button>

            <label
              className={`${isMobileSearchOpen ? 'flex' : 'hidden'} h-8 items-center gap-2 rounded-xl border border-white/10 bg-gradient-to-b from-black/20 to-black/40 px-2.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.2)] backdrop-blur-md transition-colors transition-shadow duration-200 ease-out focus-within:border-white/20 focus-within:bg-black/30 focus-within:ring-1 focus-within:ring-white/10 sm:flex`}
            >
              <Search className="h-3.5 w-3.5 text-stone-400" />
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
              className="text-ql-12 h-8 gap-1 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent px-2 pl-8 text-stone-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-md hover:border-white/20 hover:bg-white/5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] [&_svg]:text-stone-400"
              aria-label={t('sort_recent_list')}
            >
              <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5" />
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
