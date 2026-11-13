import { Input } from '@app/components/ui/input'
import { IconButton } from '@shared/ui/components/primitives'

import { Search, X } from 'lucide-react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'

interface HistorySearchFieldProps {
  value: string
  isSearchActive: boolean
  isSearchPending: boolean
  resultCount: number
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onClear: () => void
}

/**
 * Search band of the history modal.
 *
 * The pending flag covers both the debounce and a still-building index, so a
 * partially indexed result set is never shown as complete.
 */
function HistorySearchField({
  value,
  isSearchActive,
  isSearchPending,
  resultCount,
  inputRef,
  onChange,
  onClear
}: HistorySearchFieldProps) {
  const { t } = useTranslation()

  return (
    <div className="shrink-0 border-b border-white/10 bg-zinc-950/40 px-4 py-2.5">
      <div className="group/modal-search relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('api_chat_modal_search_placeholder')}
          className="text-ql-13 h-10 rounded-xl border-white/10 bg-white/[0.04] pr-24 pl-9 shadow-none focus-visible:border-white/20 focus-visible:ring-white/10"
          data-testid="history-search-input"
        />
        <Search className="text-muted-foreground group-focus-within/modal-search:text-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 transition-colors" />
        {isSearchActive && (
          <span
            data-testid="history-search-count"
            aria-live="polite"
            className="text-ql-10 absolute top-1/2 right-9 -translate-y-1/2 rounded-full bg-white/[0.06] px-1.5 py-0.5 font-medium text-zinc-300 tabular-nums"
          >
            {isSearchPending ? '…' : t('api_chat_search_results', { count: resultCount })}
          </span>
        )}
        {value && (
          <IconButton
            type="button"
            variant="ghost"
            size="compact"
            onClick={onClear}
            aria-label={t('api_chat_clear_search')}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2"
            data-testid="history-search-clear"
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
    </div>
  )
}

export default HistorySearchField
