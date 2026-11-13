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

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PdfPageNavProps {
  currentPage: number
  totalPages: number
  /** Stable identity of the open document, used to cancel a pending page edit. */
  documentId?: string | null
  onPreviousPage: () => void
  onNextPage: () => void
  onJumpToPage: (page: number) => void
}

/** Only digits, so `12abc` is rejected instead of being read as page 12. */
const PAGE_INPUT_PATTERN = /^\d+$/

function PdfPageNav({
  currentPage,
  totalPages,
  documentId,
  onPreviousPage,
  onNextPage,
  onJumpToPage
}: PdfPageNavProps) {
  const { t } = useTranslation()
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [pageInputValue, setPageInputValue] = useState('')
  const [isPageInvalid, setIsPageInvalid] = useState(false)
  const [showRevertNotice, setShowRevertNotice] = useState(false)
  const isPageEditActiveRef = useRef(false)
  const pageInputRef = useRef<HTMLInputElement>(null)
  const pageButtonRef = useRef<HTMLButtonElement>(null)
  // Escape dismisses the editor and must not drop keyboard focus on <body>.
  const restoreFocusRef = useRef(false)
  const pageErrorId = useId()
  const revertNoticeId = useId()
  const documentIdRef = useRef(documentId)
  const revertNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isEditingPage) return
    pageInputRef.current?.focus()
    pageInputRef.current?.select()
  }, [isEditingPage])

  // The display button replaces the input after Escape; focus it once it is
  // actually mounted.
  useEffect(() => {
    if (isEditingPage || !restoreFocusRef.current) return
    restoreFocusRef.current = false
    pageButtonRef.current?.focus()
  }, [isEditingPage])

  const clearRevertNotice = useCallback(() => {
    if (revertNoticeTimeoutRef.current) {
      clearTimeout(revertNoticeTimeoutRef.current)
      revertNoticeTimeoutRef.current = null
    }
    setShowRevertNotice(false)
  }, [])

  const announceRevert = useCallback(() => {
    clearRevertNotice()
    setShowRevertNotice(true)
    revertNoticeTimeoutRef.current = setTimeout(() => {
      revertNoticeTimeoutRef.current = null
      setShowRevertNotice(false)
    }, 4000)
  }, [clearRevertNotice])

  useEffect(
    () => () => {
      if (revertNoticeTimeoutRef.current) clearTimeout(revertNoticeTimeoutRef.current)
    },
    []
  )

  const startPageInput = useCallback(() => {
    clearRevertNotice()
    setPageInputValue(String(currentPage))
    setIsPageInvalid(false)
    isPageEditActiveRef.current = true
    setIsEditingPage(true)
  }, [clearRevertNotice, currentPage])

  const cancelPageInput = useCallback(() => {
    isPageEditActiveRef.current = false
    setIsPageInvalid(false)
    setIsEditingPage(false)
    setPageInputValue('')
  }, [])

  // A different document must never inherit the previous document's open page
  // editor or draft value. `currentPage` is deliberately not a dependency: a
  // page change inside the same document should not close the editor.
  useEffect(() => {
    if (documentIdRef.current === documentId) return
    documentIdRef.current = documentId
    cancelPageInput()
    clearRevertNotice()
  }, [cancelPageInput, clearRevertNotice, documentId])

  const readPageInput = useCallback((): number | null => {
    const trimmed = pageInputValue.trim()
    const page = PAGE_INPUT_PATTERN.test(trimmed) ? Number(trimmed) : Number.NaN
    return isNaN(page) || page < 1 || page > totalPages ? null : page
  }, [pageInputValue, totalPages])

  /**
   * ArrowUp/ArrowDown and the tiny stepper buttons move one page without
   * leaving the editor; the typed value stays in the box so a user can keep
   * stepping from where they are.
   */
  const stepPage = useCallback(
    (delta: number) => {
      const base = readPageInput() ?? currentPage
      const next = Math.min(totalPages, Math.max(1, base + delta))
      setIsPageInvalid(false)
      setPageInputValue(String(next))
      onJumpToPage(next)
    },
    [currentPage, onJumpToPage, readPageInput, totalPages]
  )

  /** Enter: invalid input stays open with a visible, announced error. */
  const submitPageInput = useCallback(() => {
    if (!isPageEditActiveRef.current) return
    const page = readPageInput()

    if (page === null) {
      setIsPageInvalid(true)
      return
    }

    clearRevertNotice()
    isPageEditActiveRef.current = false
    setIsPageInvalid(false)
    onJumpToPage(page)
    setIsEditingPage(false)
  }, [clearRevertNotice, onJumpToPage, readPageInput])

  /**
   * Blur: the user moved on. Commit a valid value, but never leave an empty
   * invalid field behind with no focus — revert instead. Enter keeps the field
   * open so the error can be read and corrected; blur closes it, so it shows a
   * short message naming the page that was kept. Both paths now explain the
   * rejection instead of one silently discarding the input.
   */
  const handleBlur = useCallback(() => {
    if (!isPageEditActiveRef.current) return
    const page = readPageInput()
    if (page === null) {
      cancelPageInput()
      announceRevert()
      return
    }
    clearRevertNotice()
    isPageEditActiveRef.current = false
    setIsPageInvalid(false)
    onJumpToPage(page)
    setIsEditingPage(false)
  }, [announceRevert, cancelPageInput, clearRevertNotice, onJumpToPage, readPageInput])

  return (
    <ToolbarGroup className="rounded-full border border-white/[0.07] bg-zinc-900/70 p-1">
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
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                stepPage(1)
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                stepPage(-1)
              } else if (e.key === 'Escape') {
                restoreFocusRef.current = true
                cancelPageInput()
              }
            }}
            onBlur={handleBlur}
            aria-invalid={isPageInvalid || undefined}
            aria-describedby={isPageInvalid ? pageErrorId : undefined}
            className="text-ql-12 rounded-full border-white/[0.07] bg-zinc-950/80 py-0.5 pr-4 pl-1.5 text-center font-medium tabular-nums"
            style={{
              width: `${totalPages.toString().length + 2}ch`,
              minWidth: '58px'
            }}
          />
          <span className="absolute top-1/2 right-0 flex -translate-y-1/2 flex-col">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => stepPage(1)}
              disabled={(readPageInput() ?? currentPage) >= totalPages}
              aria-label={t('page_step_up')}
              className="text-muted-foreground hover:text-foreground flex h-2.5 w-3.5 items-center justify-center disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronUp className="size-2.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => stepPage(-1)}
              disabled={(readPageInput() ?? currentPage) <= 1}
              aria-label={t('page_step_down')}
              className="text-muted-foreground hover:text-foreground flex h-2.5 w-3.5 items-center justify-center disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronDown className="size-2.5" />
            </button>
          </span>
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
        <span className="relative inline-flex">
          <Button
            ref={pageButtonRef}
            type="button"
            variant="ghost"
            size="xs"
            onClick={startPageInput}
            aria-describedby={showRevertNotice ? revertNoticeId : undefined}
            className="text-ql-12 text-foreground hover:text-primary h-auto min-w-[54px] cursor-text rounded-full border border-white/[0.07] bg-zinc-950/80 px-2.5 text-center font-medium tabular-nums"
          >
            {currentPage} <span className="text-muted-foreground mx-0.5">/</span>{' '}
            <span className="text-muted-foreground">{totalPages}</span>
          </Button>
          {showRevertNotice && (
            <span
              id={revertNoticeId}
              role="alert"
              className="border-destructive/30 bg-popover text-destructive text-ql-11 shadow-ambient-sm z-dropdown absolute bottom-full left-1/2 mb-2 w-max max-w-64 -translate-x-1/2 rounded-md border px-2 py-1 text-center"
            >
              {t('page_input_reverted', {
                page: String(currentPage),
                max: String(totalPages)
              })}
            </span>
          )}
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
