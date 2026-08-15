import { Input } from '@app/components/ui/input'

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
      const timeout = setTimeout(() => inputRef.current?.focus(), 100)
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
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute inset-0 flex w-full items-center gap-2"
          >
            <div className="group relative flex-1">
              <Search className="text-muted-foreground group-focus-within:text-primary absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 transition-colors" />
              <Input
                ref={inputRef}
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('search_placeholder')}
                className="h-8 pl-9 text-sm"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: search bar auto-focuses on open
                autoFocus
              />
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => keyword.trim() && onSearch()}
              title={t('search')}
              aria-label={t('search')}
            >
              <Search className="h-3.5 w-3.5" />
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="border-border/70 bg-card/60 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:outline-none"
              onClick={onClear}
              title={t('close')}
              aria-label={t('close')}
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          </motion.div>
        ) : (
          <div className="flex w-full max-w-[360px] min-w-0 items-center gap-1.5">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              onClick={onToggle}
              className="group border-border/70 bg-card/60 hover:border-border hover:bg-muted/60 flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-1 text-left shadow-xs transition-colors duration-150"
            >
              <div className="border-primary/20 bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors">
                <FileText className="h-3.5 w-3.5" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="text-ql-10 text-muted-foreground/80 leading-none font-semibold tracking-wider uppercase">
                  {t('reading_now') === 'reading_now' ? 'READING' : t('reading_now')}
                </span>
                <span className="text-ql-12 text-foreground block w-full truncate leading-tight font-medium">
                  {fileName || t('pdf_document')}
                </span>
              </div>

              <div className="bg-border/80 h-4 w-px shrink-0" />

              <div className="text-muted-foreground group-hover:text-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors">
                <Search className="h-3.5 w-3.5" />
              </div>
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default memo(PdfSearchBar)
