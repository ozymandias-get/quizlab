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
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-tour-id="tour-target-pdf-toolbar"
      className="z-dropdown border-border/80 bg-card/90 relative flex w-full shrink-0 items-center justify-between gap-2 border-t px-3 py-2 backdrop-blur-md select-none sm:gap-3 sm:px-4 sm:py-2.5"
    >
      <div className="relative flex items-center gap-2">
        <div className="glass-tier-3 glass-tier-toolbar border-border/70 bg-card/60 flex items-center rounded-lg border p-1.5 shadow-xs">
          <motion.button
            type="button"
            data-tools-trigger
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleTools}
            className={`focus-visible:ring-ring/40 relative flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none ${
              isToolsOpen
                ? 'bg-accent text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title={t('pdf_tools')}
            aria-label={t('pdf_tools')}
          >
            <Grid3x3 className="h-4 w-4" />
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
