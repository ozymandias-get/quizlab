import type { PdfFile } from '@shared-core/types'

import { useOcrActions } from '@features/ocr/hooks/useOcrActions'
import { useOcrStore } from '@features/ocr/store/useOcrStore'
import OcrButton from '@features/ocr/ui/OcrButton'

import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { ToolbarGroup } from '@shared/ui/components/primitives'
import { Grid3x3Icon } from '@ui/components/Icons'

import { motion } from 'motion/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePdfSearchStore } from '../hooks/usePdfSearchStore'
import PdfPageNav from './PdfPageNav'
import PdfSearchBar from './PdfSearchBar'
import PdfToolsPopup from './PdfToolsPopup'
import PdfZoomControls, { type CurrentScaleComponent, type ZoomComponent } from './PdfZoomControls'

interface PdfToolbarProps {
  pdfFile: PdfFile | null
  pdfUrl?: string | null
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
  pdfUrl,
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
  // Shared store: the app-level Ctrl/Cmd+F shortcut opens the search bar
  // through this store, so every mounted viewer instance reacts to it.
  const isSearchOpen = usePdfSearchStore((s) => s.isOpen)
  const openSearch = usePdfSearchStore((s) => s.open)
  const closeSearch = usePdfSearchStore((s) => s.close)
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const searchKeywordRef = useRef(searchKeyword)
  searchKeywordRef.current = searchKeyword
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filePathRef = useRef(pdfFile?.path)
  useEffect(() => {
    if (pdfFile?.path !== filePathRef.current) {
      filePathRef.current = pdfFile?.path
      closeSearch()
      setSearchKeyword('')
      clearHighlights()
    }
  }, [pdfFile?.path, closeSearch, clearHighlights])

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
    closeSearch()
    setSearchKeyword('')
    clearHighlights()
  }, [closeSearch, clearHighlights])

  const toggleTools = useCallback(() => {
    setIsToolsOpen((prev) => !prev)
  }, [])

  const handleOpenSearch = useCallback(() => openSearch(), [openSearch])

  const handleKeywordChange = useCallback(
    (keyword: string) => {
      setSearchKeyword(keyword)
      scheduleHighlight(keyword)
    },
    [scheduleHighlight]
  )

  // OCR handler: on-demand page-level OCR — always opens panel, even on error
  const { processPage } = useOcrActions()
  const ocrStatus = useOcrStore((s) => s.status)
  const openOcrPanel = useOcrStore((s) => s.openPanel)
  const isOcrLoading =
    ocrStatus === 'rendering-page' ||
    ocrStatus === 'initializing-engine' ||
    ocrStatus === 'processing'
  const handleOcrPage = useCallback(() => {
    if (!pdfFile) {
      openOcrPanel()
      return
    }
    // If already loading this exact page, just ensure panel is visible
    if (isOcrLoading && useOcrStore.getState().currentPage === currentPage) {
      openOcrPanel()
      return
    }
    openOcrPanel()
    void processPage({
      pageNumber: currentPage,
      pdfFile,
      pdfUrl: pdfUrl ?? pdfFile.streamUrl ?? null
    }).catch(() => {
      // panel already shows error state via store
    })
  }, [pdfFile, pdfUrl, currentPage, isOcrLoading, processPage, openOcrPanel])

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-tour-id="tour-target-pdf-toolbar"
      className="border-border/80 bg-card/90 relative flex w-full shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5 select-none sm:gap-3"
    >
      <div className="relative flex items-center gap-2">
        <ToolbarGroup>
          <WithTooltip label={t('pdf_tools')}>
            <IconButton
              asChild
              type="button"
              data-tools-trigger
              variant="ghost"
              size="compact"
              onClick={toggleTools}
              aria-label={t('pdf_tools')}
              className={
                isToolsOpen ? 'bg-accent text-foreground shadow-xs' : 'text-muted-foreground'
              }
            >
              <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Grid3x3Icon size="sm" />
              </motion.button>
            </IconButton>
          </WithTooltip>
        </ToolbarGroup>

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

        {/* OCR — always visible, disabled when no PDF, amber highlight */}
        <ToolbarGroup>
          <OcrButton onClick={handleOcrPage} currentPage={currentPage} disabled={!pdfFile} />
        </ToolbarGroup>
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
