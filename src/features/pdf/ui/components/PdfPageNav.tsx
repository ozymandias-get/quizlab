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
    <div className="glass-tier-3 glass-tier-toolbar flex items-center gap-1 p-1.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPreviousPage}
        disabled={currentPage <= 1}
        className="h-8 w-8 rounded-xl text-white/50 transition-[background-color,color,border-color,box-shadow] duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-25 disabled:hover:bg-transparent [&_svg]:transition-none"
        title={t('prev_page')}
        aria-label={t('prev_page')}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="h-5 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

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
          className="text-ql-12 rounded-md border border-white/20 bg-white/[0.08] px-2 py-0.5 text-center font-medium text-white/80 tabular-nums transition-colors outline-none focus:border-amber-500/50 focus:bg-white/[0.12]"
          style={{ width: `${Math.max(60, totalPages.toString().length * 12 + 24)}px` }}
        />
      ) : (
        <button
          type="button"
          onClick={startPageInput}
          className="text-ql-12 min-w-[60px] cursor-text px-3 text-center font-medium text-white/70 tabular-nums transition-colors hover:text-white/90"
        >
          {currentPage} <span className="mx-0.5 text-white/20">/</span> {totalPages}
        </button>
      )}

      <div className="h-5 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onNextPage}
        disabled={currentPage >= totalPages}
        className="h-8 w-8 rounded-xl text-white/50 transition-[background-color,color,border-color,box-shadow] duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-25 disabled:hover:bg-transparent [&_svg]:transition-none"
        title={t('next_page')}
        aria-label={t('next_page')}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default memo(PdfPageNav)
