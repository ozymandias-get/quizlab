import { Input } from '@app/components/ui/input'
import {
  Button,
  IconButton,
  ToolbarGroup,
  ToolbarSeparator,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PdfPageNavProps {
  currentPage: number
  totalPages: number
  onPreviousPage: () => void
  onNextPage: () => void
  onJumpToPage: (page: number) => void
}

/** Only digits, so `12abc` is rejected instead of being read as page 12. */
const PAGE_INPUT_PATTERN = /^\d+$/

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
  const [isPageInvalid, setIsPageInvalid] = useState(false)
  const isPageEditActiveRef = useRef(false)
  const pageInputRef = useRef<HTMLInputElement>(null)
  const pageErrorId = useId()

  useEffect(() => {
    if (!isEditingPage) return
    pageInputRef.current?.focus()
    pageInputRef.current?.select()
  }, [isEditingPage])

  const startPageInput = useCallback(() => {
    setPageInputValue(String(currentPage))
    setIsPageInvalid(false)
    isPageEditActiveRef.current = true
    setIsEditingPage(true)
  }, [currentPage])

  const cancelPageInput = useCallback(() => {
    isPageEditActiveRef.current = false
    setIsPageInvalid(false)
    setIsEditingPage(false)
    setPageInputValue('')
  }, [])

  const readPageInput = useCallback((): number | null => {
    const trimmed = pageInputValue.trim()
    const page = PAGE_INPUT_PATTERN.test(trimmed) ? Number(trimmed) : Number.NaN
    return isNaN(page) || page < 1 || page > totalPages ? null : page
  }, [pageInputValue, totalPages])

  /** Enter: invalid input stays open with a visible, announced error. */
  const submitPageInput = useCallback(() => {
    if (!isPageEditActiveRef.current) return
    const page = readPageInput()

    if (page === null) {
      setIsPageInvalid(true)
      return
    }

    isPageEditActiveRef.current = false
    setIsPageInvalid(false)
    onJumpToPage(page)
    setIsEditingPage(false)
  }, [onJumpToPage, readPageInput])

  /**
   * Blur: the user moved on. Commit a valid value, but never leave an empty
   * invalid field behind with no focus — revert instead. (Enter keeps the
   * field open so the error can be read and corrected.)
   */
  const handleBlur = useCallback(() => {
    if (!isPageEditActiveRef.current) return
    const page = readPageInput()
    if (page === null) {
      cancelPageInput()
      return
    }
    isPageEditActiveRef.current = false
    setIsPageInvalid(false)
    onJumpToPage(page)
    setIsEditingPage(false)
  }, [cancelPageInput, onJumpToPage, readPageInput])

  return (
    <ToolbarGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            variant="ghost"
            size="compact"
            onClick={onPreviousPage}
            disabled={currentPage <= 1}
            className="text-muted-foreground"
            aria-label={t('prev_page')}
          >
            <ChevronLeft className="size-3.5" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>{t('prev_page')}</TooltipContent>
      </Tooltip>

      <ToolbarSeparator />

      {isEditingPage ? (
        <span className="relative inline-flex">
          <Input
            ref={pageInputRef}
            type="text"
            inputMode="numeric"
            size="sm"
            value={pageInputValue}
            onChange={(e) => {
              setPageInputValue(e.target.value.replaceAll(/\D/g, ''))
              if (isPageInvalid) setIsPageInvalid(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitPageInput()
              } else if (e.key === 'Escape') {
                cancelPageInput()
              }
            }}
            onBlur={handleBlur}
            aria-invalid={isPageInvalid || undefined}
            aria-describedby={isPageInvalid ? pageErrorId : undefined}
            className="text-ql-12 px-1.5 py-0.5 text-center font-medium tabular-nums"
            style={{ width: `${Math.max(54, totalPages.toString().length * 10 + 20)}px` }}
          />
          {isPageInvalid && (
            <span
              id={pageErrorId}
              role="alert"
              className="border-destructive/30 bg-popover text-destructive text-ql-11 shadow-ambient-sm z-dropdown absolute bottom-full left-1/2 mb-2 w-max max-w-64 -translate-x-1/2 rounded-md border px-2 py-1 text-center"
            >
              {t('page_input_range', { max: String(totalPages) })}
            </span>
          )}
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={startPageInput}
          className="text-ql-12 text-foreground hover:text-primary h-auto min-w-[54px] cursor-text px-2 text-center font-medium tabular-nums"
        >
          {currentPage} <span className="text-muted-foreground mx-0.5">/</span>{' '}
          <span className="text-muted-foreground">{totalPages}</span>
        </Button>
      )}

      <ToolbarSeparator />

      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            variant="ghost"
            size="compact"
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="text-muted-foreground"
            aria-label={t('next_page')}
          >
            <ChevronRight className="size-3.5" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>{t('next_page')}</TooltipContent>
      </Tooltip>
    </ToolbarGroup>
  )
}

export default memo(PdfPageNav)
