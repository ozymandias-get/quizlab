import { Input } from '@app/components/ui/input'
import { IconButton } from '@shared/ui/components/primitives'

import { Search, X } from 'lucide-react'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
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

/** Breathing room between the field text and the counter/clear rail. */
const RAIL_GAP_PX = 6

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
  const fieldRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [railReserve, setRailReserve] = useState(0)

  // The rail is absolutely positioned over the field, so the input has to
  // reserve the space it really takes. A fixed padding is wrong in both
  // directions: a wide count ("1,200 results") runs under the badge, and a
  // narrow one leaves dead space. Measure the rail against the field edge and
  // follow it as the badge text, the clear button or the font changes.
  useLayoutEffect(() => {
    const field = fieldRef.current
    const rail = railRef.current
    if (!field || !rail) return

    const measure = () => {
      const fieldRect = field.getBoundingClientRect()
      // Before layout (or in jsdom) there is nothing to measure yet.
      if (fieldRect.width === 0) return

      const railRect = rail.getBoundingClientRect()
      // An empty rail (search cleared) must give the field its normal padding
      // back instead of keeping the last measured reserve.
      if (railRect.width === 0) {
        setRailReserve(0)
        return
      }
      setRailReserve(Math.ceil(fieldRect.right - railRect.left) + RAIL_GAP_PX)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="shrink-0 border-b border-white/[0.07] bg-zinc-950/40 px-4 py-2.5">
      <div
        ref={fieldRef}
        className="group/modal-search relative"
        data-testid="history-search-field"
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('api_chat_modal_search_placeholder')}
          className="text-ql-13 h-10 rounded-xl pl-9"
          style={railReserve > 0 ? { paddingRight: railReserve } : undefined}
          data-testid="history-search-input"
        />
        <Search className="text-muted-foreground group-focus-within/modal-search:text-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 transition-colors" />
        {/* Counter and clear share one flex rail so they cannot overlap each
            other. The input reserves exactly this rail's measured width. */}
        <div
          ref={railRef}
          data-testid="history-search-rail"
          className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1"
        >
          {isSearchActive && (
            <span
              data-testid="history-search-count"
              aria-live="polite"
              aria-label={isSearchPending ? t('api_chat_searching') : undefined}
              className="text-ql-10 max-w-[9rem] shrink-0 truncate rounded-full bg-white/[0.06] px-1.5 py-0.5 font-medium whitespace-nowrap text-zinc-300 tabular-nums"
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
              className="text-muted-foreground hover:text-foreground shrink-0"
              data-testid="history-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  )
}

export default HistorySearchField
