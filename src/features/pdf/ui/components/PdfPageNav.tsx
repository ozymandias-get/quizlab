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

  const submitPageInput = useCallback(() => {
    if (!isPageEditActiveRef.current) return
    const trimmed = pageInputValue.trim()
    const page = PAGE_INPUT_PATTERN.test(trimmed) ? Number(trimmed) : Number.NaN

    if (isNaN(page) || page < 1 || page > totalPages) {
      // Keep the field open so the user can correct it; the range is exposed
      // through the description and the error is announced, not swallowed.
      setIsPageInvalid(true)
      return
    }

    isPageEditActiveRef.current = false
    setIsPageInvalid(false)
    onJumpToPage(page)
    setIsEditingPage(false)
  }, [pageInputValue, totalPages, onJumpToPage])

  const cancelPageInput = useCallback(() => {
    isPageEditActiveRef.current = false
    setIsPageInvalid(false)
    setIsEditingPage(false)
    setPageInputValue('')
  }, [])

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
          onBlur={submitPageInput}
          aria-invalid={isPageInvalid || undefined}
          aria-describedby={isPageInvalid ? pageErrorId : undefined}
          title={t('page_input_range', { max: String(totalPages) })}
          className="text-ql-12 px-1.5 py-0.5 text-center font-medium tabular-nums"
          style={{ width: `${Math.max(54, totalPages.toString().length * 10 + 20)}px` }}
        />
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

      {isPageInvalid && (
        <span id={pageErrorId} role="alert" className="sr-only">
          {t('page_input_range', { max: String(totalPages) })}
        </span>
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
