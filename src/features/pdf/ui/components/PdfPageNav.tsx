import { Button } from '@app/components/ui/button'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PdfPageNavProps {
  currentPage: number
  totalPages: number
  onPreviousPage: () => void
  onNextPage: () => void
  onJumpToPage: (page: number) => void
}

function PdfPageNav({
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  onJumpToPage
}: PdfPageNavProps) {
  const { t } = useTranslation()
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [pageInputValue, setPageInputValue] = useState('')
  const isPageEditActiveRef = useRef(false)

  const startPageInput = useCallback(() => {
    setPageInputValue(String(currentPage))
    isPageEditActiveRef.current = true
    setIsEditingPage(true)
  }, [currentPage])

  const submitPageInput = useCallback(() => {
    if (!isPageEditActiveRef.current) return
    isPageEditActiveRef.current = false
    const trimmed = pageInputValue.trim()
    const page = parseInt(trimmed, 10)
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onJumpToPage(page)
    }
    setIsEditingPage(false)
  }, [pageInputValue, totalPages, onJumpToPage])

  const cancelPageInput = useCallback(() => {
    isPageEditActiveRef.current = false
    setIsEditingPage(false)
    setPageInputValue('')
  }, [])

  return (
    <div className="glass-tier-3 glass-tier-toolbar border-border/70 bg-card/60 flex items-center gap-1 rounded-lg border p-1.5 shadow-xs">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onPreviousPage}
        disabled={currentPage <= 1}
        className="text-muted-foreground hover:bg-muted hover:text-foreground h-7 w-7 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        title={t('prev_page')}
        aria-label={t('prev_page')}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      <div className="bg-border/80 h-4 w-px" />

      {isEditingPage ? (
        <input
          ref={(el) => el?.focus()}
          type="text"
          inputMode="numeric"
          value={pageInputValue}
          onChange={(e) => setPageInputValue(e.target.value.replaceAll(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitPageInput()
            } else if (e.key === 'Escape') {
              cancelPageInput()
            }
          }}
          onBlur={submitPageInput}
          className="text-ql-12 border-border bg-background text-foreground focus-visible:border-ring rounded-md border px-1.5 py-0.5 text-center font-medium tabular-nums outline-none"
          style={{ width: `${Math.max(54, totalPages.toString().length * 10 + 20)}px` }}
        />
      ) : (
        <button
          type="button"
          onClick={startPageInput}
          className="text-ql-12 text-foreground hover:text-primary min-w-[54px] cursor-text px-2 text-center font-medium tabular-nums transition-colors"
        >
          {currentPage} <span className="text-muted-foreground/40 mx-0.5">/</span>{' '}
          <span className="text-muted-foreground">{totalPages}</span>
        </button>
      )}

      <div className="bg-border/80 h-4 w-px" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onNextPage}
        disabled={currentPage >= totalPages}
        className="text-muted-foreground hover:bg-muted hover:text-foreground h-7 w-7 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        title={t('next_page')}
        aria-label={t('next_page')}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export default memo(PdfPageNav)
