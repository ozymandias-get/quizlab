import { BlurFade } from '@app/components/ui/blur-fade'
import { Input } from '@app/components/ui/input'
import { InputGroup, InputGroupAddon } from '@app/components/ui/input-group'
import { SEARCH_INPUT_FOCUS_MS } from '@shared/constants/timingConstants'
import { DURATION } from '@shared/lib/motion'
import {
  Button,
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'

import { FileText, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type KeyboardEvent, memo, useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface PdfSearchBarProps {
  isOpen: boolean
  onToggle: () => void
  keyword: string
  onKeywordChange: (keyword: string) => void
  onSearch: () => void
  onClear: () => void
  /** Matches painted by the renderer for the current query. */
  matchCount?: number
  fileName?: string
  /** `Aa`: match without folding case. */
  caseSensitive?: boolean
  /** Match only whole words. */
  wholeWord?: boolean
  onToggleCaseSensitive?: () => void
  onToggleWholeWord?: () => void
}

function PdfSearchBar({
  isOpen,
  onToggle,
  keyword,
  onKeywordChange,
  onSearch,
  onClear,
  matchCount = 0,
  fileName,
  caseSensitive = false,
  wholeWord = false,
  onToggleCaseSensitive,
  onToggleWholeWord
}: PdfSearchBarProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)

  const hasQuery = keyword.trim().length > 0
  const hasNoMatches = hasQuery && matchCount === 0

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => inputRef.current?.focus(), SEARCH_INPUT_FOCUS_MS)
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  // The trailing controls (toggles, counter, clear) change width with the
  // query, the digit count and the active toggles. Reserve exactly what they
  // occupy instead of a fixed right padding, which either overlapped the text
  // or wasted the field on a narrow panel. `offsetWidth` is the layout box, so
  // the popover's entrance scale does not shrink the measurement.
  useLayoutEffect(() => {
    const input = inputRef.current
    const controls = controlsRef.current
    if (!isOpen || !input || !controls) return

    const applyReserve = () => {
      // 8px inset of the controls plus a 4px gap before the caret.
      input.style.paddingRight = `${Math.ceil(controls.offsetWidth) + 12}px`
    }
    applyReserve()

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        input.style.paddingRight = ''
      }
    }
    const observer = new ResizeObserver(applyReserve)
    observer.observe(controls)
    return () => {
      observer.disconnect()
      input.style.paddingRight = ''
    }
  }, [isOpen])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && keyword.trim()) {
      // Do not let an enclosing form submit or another default action run.
      e.preventDefault()
      e.stopPropagation()
      onSearch()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClear()
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <AnimatePresence mode="wait">
        {isOpen ? (
          // A floating popover below the toolbar row: opening search no longer
          // squeezes page navigation and zoom out of the bar. It anchors to the
          // toolbar (the search slot collapses while the chip is gone), so it
          // stays under the bar and inside the viewer at every panel width.
          <motion.div
            key="search"
            initial={{ opacity: 0, scale: 0.98, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -2 }}
            transition={{ duration: DURATION.normal }}
            className="z-dropdown absolute top-[calc(100%+0.5rem)] left-1/2 flex w-[min(26rem,calc(100cqw-1rem))] -translate-x-1/2 items-center gap-1.5 rounded-xl border border-white/12 bg-zinc-950/95 p-2 text-zinc-100 shadow-2xl backdrop-blur-xl"
          >
            <BlurFade
              duration={DURATION.normal}
              offset={4}
              blur="4px"
              direction="up"
              className="flex w-full items-center gap-1.5"
            >
              <InputGroup className="flex-1">
                <InputGroupAddon align="inline-start">
                  <Search className="text-muted-foreground h-3.5 w-3.5" />
                </InputGroupAddon>
                <Input
                  ref={inputRef}
                  value={keyword}
                  onChange={(e) => onKeywordChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('search_placeholder')}
                  aria-invalid={hasNoMatches}
                  aria-describedby="pdf-search-match-count"
                  className="text-ql-12 min-w-0 pl-8 font-normal"
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: search bar auto-focuses on open
                  autoFocus
                />
                <div ref={controlsRef} className="absolute right-2 flex items-center gap-0.5">
                  {onToggleCaseSensitive && (
                    <button
                      type="button"
                      onClick={onToggleCaseSensitive}
                      aria-pressed={caseSensitive}
                      aria-label={t('search_match_case')}
                      title={t('search_match_case')}
                      className={`text-ql-10 focus-visible:ring-ring/70 flex h-5 min-w-5 items-center justify-center rounded px-1 font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                        caseSensitive
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/10'
                      }`}
                    >
                      Aa
                    </button>
                  )}
                  {onToggleWholeWord && (
                    <button
                      type="button"
                      onClick={onToggleWholeWord}
                      aria-pressed={wholeWord}
                      aria-label={t('search_whole_word')}
                      title={t('search_whole_word')}
                      className={`text-ql-10 focus-visible:ring-ring/70 flex h-5 min-w-5 items-center justify-center rounded px-1 font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                        wholeWord
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/10'
                      }`}
                    >
                      W
                    </button>
                  )}
                  {/* Every match is painted at once and there is no
                      next/previous navigation, so there is no "current"
                      match: `1/N` claimed a position that does not exist.
                      The total is the whole truth. */}
                  <span
                    id="pdf-search-match-count"
                    data-testid="pdf-search-match-count"
                    aria-live="polite"
                    className={`text-ql-10 font-mono tabular-nums ${
                      hasNoMatches ? 'text-destructive font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {matchCount}
                  </span>
                  {keyword ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <IconButton
                          type="button"
                          size="compact"
                          variant="ghost"
                          onClick={() => onKeywordChange('')}
                          aria-label={t('clear')}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3.5" />
                        </IconButton>
                      </TooltipTrigger>
                      <TooltipContent>{t('clear')}</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              </InputGroup>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconButton
                      type="button"
                      variant="outline"
                      size="compact"
                      onClick={() => keyword.trim() && onSearch()}
                      aria-label={t('search')}
                    >
                      <Search className="size-3.5" />
                    </IconButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('search')}</TooltipContent>
                </Tooltip>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconButton
                      type="button"
                      variant="outline"
                      size="compact"
                      onClick={onClear}
                      className="text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t('close')}
                    >
                      <X className="size-3.5" />
                    </IconButton>
                  </TooltipTrigger>
                  <TooltipContent>{t('close')}</TooltipContent>
                </Tooltip>
              </motion.div>
            </BlurFade>
          </motion.div>
        ) : (
          <div className="flex w-full max-w-[380px] min-w-0 items-center gap-1.5">
            <Button
              asChild
              type="button"
              variant="outline"
              className="group motion-normal @container h-auto min-w-0 flex-1 cursor-pointer justify-start gap-2.5 overflow-hidden rounded-full border border-white/[0.07] bg-zinc-900/45 px-2.5 py-1 text-left transition-colors hover:bg-white/5"
            >
              <motion.button
                type="button"
                aria-label={fileName || t('pdf_document')}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={onToggle}
              >
                <div className="text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.04] transition-colors">
                  <FileText className="h-3.5 w-3.5" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center @max-[80px]:hidden">
                  <span className="text-ql-10 text-muted-foreground tracking-ql-label hidden truncate leading-none font-semibold uppercase sm:block">
                    {t('reading_now') === 'reading_now' ? 'READING' : t('reading_now')}
                  </span>
                  <span className="text-ql-12 text-foreground block w-full truncate leading-tight font-medium">
                    {fileName || t('pdf_document')}
                  </span>
                </div>

                <div className="h-4 w-px shrink-0 bg-white/10 @max-[190px]:hidden" />

                <div className="flex items-center gap-1.5 @max-[190px]:hidden">
                  <div className="text-muted-foreground group-hover:text-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                </div>
              </motion.button>
            </Button>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default memo(PdfSearchBar)
