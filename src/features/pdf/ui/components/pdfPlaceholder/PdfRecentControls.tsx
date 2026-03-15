import { ArrowUpDown, Search } from 'lucide-react'
import { Button } from '@ui/components/button'
import type { SortMode } from './types'

interface PdfRecentControlsProps {
  t: (key: string) => string
  recentCount: number
  shouldShowAdvancedControls: boolean
  searchQuery: string
  sortMode: SortMode
  isMobileSearchOpen: boolean
  canClear: boolean
  onSearchQueryChange: (value: string) => void
  onSortModeChange: (value: SortMode) => void
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
  return (
    <>
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 text-left">
          <h3 className="text-sm font-semibold text-stone-200">{t('resume_reading')}</h3>
          <p className="mt-0.5 text-[11px] text-stone-500">{t('resume_reading_desc')}</p>
        </div>
        {recentCount > 0 && canClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 px-2.5 rounded-lg text-[11px] text-stone-300/80 hover:text-stone-100 hover:bg-white/10 border border-white/10"
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
              className="sm:hidden h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-stone-300 hover:text-stone-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
              aria-label={t('search_recent')}
            >
              <Search className="w-4 h-4 mx-auto" />
            </button>

            <label
              className={`${isMobileSearchOpen ? 'flex' : 'hidden'} sm:flex items-center gap-2 h-8 px-2 rounded-lg border border-white/10 bg-white/5`}
            >
              <Search className="w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder={t('search_recent_placeholder')}
                className="w-36 sm:w-44 bg-transparent text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none"
                aria-label={t('search_recent')}
              />
            </label>
          </div>

          <label className="relative flex items-center">
            <ArrowUpDown className="absolute left-2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
            <select
              value={sortMode}
              onChange={(event) => onSortModeChange(event.target.value as SortMode)}
              className="h-8 pl-7 pr-7 rounded-lg border border-white/10 bg-white/5 text-xs text-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 appearance-none"
              aria-label={t('sort_recent_list')}
            >
              <option value="recent">{t('sort_recent')}</option>
              <option value="name">{t('sort_name')}</option>
            </select>
          </label>
        </div>
      )}
    </>
  )
}

export default PdfRecentControls
