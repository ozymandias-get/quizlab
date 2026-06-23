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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-0 flex w-full items-center gap-2"
          >
            <div className="group relative flex-1">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-amber-400" />
              {}
              <Input
                ref={inputRef}
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('search_placeholder')}
                className="pl-9"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: search bar auto-focuses on open
                autoFocus
              />
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-xl p-2 text-white/50 transition-colors hover:bg-amber-400/10 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
              onClick={() => keyword.trim() && onSearch()}
              title={t('search')}
              aria-label={t('search')}
            >
              <Search className="h-4 w-4" />
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-xl p-2 text-white/50 transition-colors hover:bg-red-400/10 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
              onClick={onClear}
              title={t('close')}
              aria-label={t('close')}
            >
              <X className="h-4 w-4" />
            </motion.button>
          </motion.div>
        ) : (
          <div className="flex w-full max-w-[380px] min-w-0 items-center gap-1.5">
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onToggle}
              className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent px-3 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_2px_8px_-4px_rgba(0,0,0,0.3)] transition-all duration-300 hover:border-amber-500/20 hover:from-white/[0.08] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_12px_-4px_rgba(245,158,11,0.12)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-500/15 to-amber-600/5 transition-all duration-300 group-hover:border-amber-500/30 group-hover:from-amber-500/20 group-hover:to-amber-600/10 group-hover:shadow-[0_0_12px_-4px_rgba(245,158,11,0.2)]">
                <FileText className="h-4 w-4 text-amber-400 transition-colors duration-300 group-hover:text-amber-300" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                <span className="text-ql-10 mb-0.5 truncate leading-none font-semibold tracking-wider text-white/25 uppercase transition-colors duration-300 group-hover:text-amber-400/40">
                  {t('reading_now') === 'reading_now' ? 'READING' : t('reading_now')}
                </span>
                <span className="text-ql-12 block w-full truncate leading-tight font-medium text-white/70 transition-colors duration-300 group-hover:text-white/90">
                  {fileName || t('pdf_document')}
                </span>
              </div>

              <div className="h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 hover:bg-white/[0.06]">
                <Search className="h-4 w-4 text-white/30 transition-colors duration-300 group-hover:text-amber-400/60" />
              </div>
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default memo(PdfSearchBar)
