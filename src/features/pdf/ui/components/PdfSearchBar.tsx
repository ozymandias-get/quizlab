import { Button } from '@app/components/ui/button'
import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import { InputGroup, InputGroupAddon } from '@app/components/ui/input-group'
import { Kbd } from '@app/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import { SEARCH_INPUT_FOCUS_MS } from '@shared/constants/timingConstants'
import { DURATION } from '@shared/lib/motion'
import { getShortcutModifierLabel } from '@shared/lib/shortcutUtils'

import { FileText, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type KeyboardEvent, memo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface PdfSearchBarProps {
  isOpen: boolean
  onToggle: () => void
  keyword: string
  onKeywordChange: (keyword: string) => void
  onSearch: () => void
  onClear: () => void
  fileName?: string
}

function PdfSearchBar({
  isOpen,
  onToggle,
  keyword,
  onKeywordChange,
  onSearch,
  onClear,
  fileName
}: PdfSearchBarProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => inputRef.current?.focus(), SEARCH_INPUT_FOCUS_MS)
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && keyword.trim()) {
      onSearch()
    } else if (e.key === 'Escape') {
      onClear()
    }
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, scale: 0.98, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -2 }}
            transition={{ duration: DURATION.normal }}
            className="absolute inset-0 flex w-full items-center gap-1.5"
          >
            <InputGroup className="flex-1">
              <InputGroupAddon align="inline-start">
                <Search className="text-muted-foreground/80 h-3.5 w-3.5" />
              </InputGroupAddon>
              <Input
                ref={inputRef}
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('search_placeholder')}
                className="text-ql-12 pr-16 pl-8 font-normal"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: search bar auto-focuses on open
                autoFocus
              />
              <div className="absolute right-2 flex items-center gap-1">
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
                <Kbd size="xs" variant="outline" className="opacity-70">
                  Esc
                </Kbd>
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
          </motion.div>
        ) : (
          <div className="flex w-full max-w-[380px] min-w-0 items-center gap-1.5">
            <Button
              asChild
              type="button"
              variant="outline"
              className="group border-border/80 bg-card/70 hover:border-border hover:bg-muted/60 h-auto min-w-0 flex-1 cursor-pointer justify-start gap-2.5 rounded-lg px-2.5 py-1 text-left shadow-2xs transition-colors"
            >
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.995 }}
                onClick={onToggle}
              >
                <div className="border-primary/20 bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors">
                  <FileText className="h-3.5 w-3.5" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <span className="text-ql-10 text-muted-foreground/80 tracking-ql-label hidden leading-none font-semibold uppercase sm:block">
                    {t('reading_now') === 'reading_now' ? 'READING' : t('reading_now')}
                  </span>
                  <span className="text-ql-12 text-foreground block w-full truncate leading-tight font-medium">
                    {fileName || t('pdf_document')}
                  </span>
                </div>

                <div className="bg-border/80 h-4 w-px shrink-0" />

                <div className="flex items-center gap-1.5">
                  <div className="text-muted-foreground group-hover:text-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  <Kbd size="xs" variant="default" className="hidden opacity-80 sm:inline-flex">
                    {getShortcutModifierLabel()}+F
                  </Kbd>
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
