import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import { ToolbarGroup, ToolbarSeparator } from '@shared/ui/components/primitives'

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
          ref={(el) => el?.focus()}
          type="text"
          inputMode="numeric"
          size="sm"
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
          {currentPage} <span className="text-muted-foreground/40 mx-0.5">/</span>{' '}
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
