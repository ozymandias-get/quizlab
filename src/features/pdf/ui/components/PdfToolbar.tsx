import type { PdfFile } from '@shared-core/types'

import { Grid3x3 } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import PdfPageNav from './PdfPageNav'
import PdfSearchBar from './PdfSearchBar'
import PdfToolsPopup from './PdfToolsPopup'
import PdfZoomControls, { type CurrentScaleComponent, type ZoomComponent } from './PdfZoomControls'

interface PdfToolbarProps {
  pdfFile: PdfFile | null
  onStartScreenshot: () => void
  onFullPageScreenshot: () => void
  autoSend: boolean
  onToggleAutoSend: () => void
  panMode: boolean
  onTogglePanMode: () => void
  currentPage: number
  totalPages: number
  onPreviousPage: () => void
  onNextPage: () => void
  onJumpToPage: (page: number) => void
  highlight: (keyword: string) => void
  clearHighlights: () => void
  ZoomIn: ZoomComponent
  ZoomOut: ZoomComponent
  CurrentScale: CurrentScaleComponent
  onAddCurrentPageTextToAi?: () => void
}

function PdfToolbar({
  pdfFile,
  onStartScreenshot,
  onFullPageScreenshot,
  autoSend,
  onToggleAutoSend,
  panMode,
  onTogglePanMode,
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  onJumpToPage,
  highlight,
  clearHighlights,
  ZoomIn,
  ZoomOut,
  CurrentScale,
  onAddCurrentPageTextToAi
}: PdfToolbarProps) {
  const { t } = useTranslation()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const searchKeywordRef = useRef(searchKeyword)
  searchKeywordRef.current = searchKeyword
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filePathRef = useRef(pdfFile?.path)
  useEffect(() => {
    if (pdfFile?.path !== filePathRef.current) {
      filePathRef.current = pdfFile?.path
      setIsSearchOpen(false)
      setSearchKeyword('')
      clearHighlights()
    }
  }, [pdfFile?.path, clearHighlights])

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [])

  const scheduleHighlight = useCallback(
    (keyword: string) => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
      searchDebounceRef.current = setTimeout(() => {
        if (keyword.trim()) {
          highlight(keyword)
        }
      }, 300)
    },
    [highlight]
  )

  const handleSearch = useCallback(() => {
    const keyword = searchKeywordRef.current
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }
    if (keyword.trim()) {
      highlight(keyword)
    }
  }, [highlight])

  const handleClearSearch = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }
    setIsSearchOpen(false)
    setSearchKeyword('')
    clearHighlights()
  }, [clearHighlights])

  const toggleTools = useCallback(() => {
    setIsToolsOpen((prev) => !prev)
  }, [])

  const handleOpenSearch = useCallback(() => setIsSearchOpen(true), [])

  const handleKeywordChange = useCallback(
    (keyword: string) => {
      setSearchKeyword(keyword)
      scheduleHighlight(keyword)
    },
    [scheduleHighlight]
  )

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-tour-id="tour-target-pdf-toolbar"
      className="z-dropdown relative flex w-full shrink-0 items-center justify-between gap-2 border-t border-white/[0.08] bg-gradient-to-t from-[#05070d] via-[#05070d]/95 to-transparent px-3 py-2.5 select-none sm:gap-3 sm:px-6 sm:py-3"
    >
      <div className="relative flex items-center gap-2">
        <div className="glass-tier-3 glass-tier-toolbar flex items-center p-1.5">
          <motion.button
            type="button"
            data-tools-trigger
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTools}
            className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none ${
              isToolsOpen
                ? 'border border-white/[0.18] bg-gradient-to-br from-white/[0.14] to-white/[0.06] text-white shadow-[0_0_20px_-6px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'border border-transparent text-white/55 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_12px_-4px_rgba(255,255,255,0.06)]'
            }`}
            title={t('pdf_tools')}
            aria-label={t('pdf_tools')}
          >
            <Grid3x3 className="h-4 w-4" />
            {isToolsOpen && (
              <motion.div
                layoutId="tools-active-ring"
                className="absolute inset-0 rounded-xl border border-amber-500/25"
                initial={false}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        </div>

        <PdfToolsPopup
          isOpen={isToolsOpen}
          onToggle={toggleTools}
          onAddCurrentPageTextToAi={onAddCurrentPageTextToAi}
          panMode={panMode}
          onTogglePanMode={onTogglePanMode}
          onStartScreenshot={onStartScreenshot}
          onFullPageScreenshot={onFullPageScreenshot}
          autoSend={autoSend}
          onToggleAutoSend={onToggleAutoSend}
        />
      </div>

      <div className="mx-2 flex min-w-0 flex-1 items-center justify-center">
        <PdfSearchBar
          isOpen={isSearchOpen}
          onToggle={handleOpenSearch}
          keyword={searchKeyword}
          onKeywordChange={handleKeywordChange}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          fileName={pdfFile?.name}
        />
      </div>

      <div className="flex items-center gap-2">
        <PdfPageNav
          currentPage={currentPage}
          totalPages={totalPages}
          onPreviousPage={onPreviousPage}
          onNextPage={onNextPage}
          onJumpToPage={onJumpToPage}
        />
        <PdfZoomControls ZoomIn={ZoomIn} ZoomOut={ZoomOut} CurrentScale={CurrentScale} />
      </div>
    </motion.div>
  )
}

export default memo(PdfToolbar)
