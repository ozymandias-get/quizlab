import type { PdfFile } from '@shared-core/types'

import { useOcrActions } from '@features/ocr/hooks/useOcrActions'
import { useOcrStore } from '@features/ocr/store/useOcrStore'
import OcrButton from '@features/ocr/ui/OcrButton'

import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { cn } from '@shared/lib/uiUtils'
import { ToolbarGroup } from '@shared/ui/components/primitives'

import { Hand } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePdfSearchStore } from '../hooks/usePdfSearchStore'
import PdfPageNav from './PdfPageNav'
import PdfSearchBar from './PdfSearchBar'
import PdfZoomControls, { type CurrentScaleComponent, type ZoomComponent } from './PdfZoomControls'

interface PdfToolbarProps {
  pdfFile: PdfFile | null
  pdfUrl?: string | null
  onStartScreenshot?: () => void
  onFullPageScreenshot?: () => void
  autoSend?: boolean
  onToggleAutoSend?: () => void
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
  CurrentScale
}: PdfToolbarProps) {
  const { t } = useTranslation()
  // Shared store: the app-level Ctrl/Cmd+F shortcut opens the search bar
  // through this store, so every mounted viewer instance reacts to it.
  const isSearchOpen = usePdfSearchStore((s) => s.isOpen)
  const openSearch = usePdfSearchStore((s) => s.open)
  const closeSearch = usePdfSearchStore((s) => s.close)
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
          {/* Pan Mode — Kaydır */}
          <WithTooltip label={t('pdf_pan_mode')}>
            <IconButton
              type="button"
              variant={panMode ? 'secondary' : 'ghost'}
              size="compact"
              onClick={onTogglePanMode}
              aria-label={t('pdf_pan_mode')}
              aria-pressed={panMode}
              className={cn(
                'transition-colors',
                panMode
                  ? 'border-sky-500/30 bg-sky-500/15 text-sky-600 shadow-xs dark:text-sky-400'
                  : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-sky-500/20 hover:bg-sky-500/10'
              )}
              data-testid="pan-mode-button"
            >
              <Hand className="size-3.5" aria-hidden="true" />
            </IconButton>
          </WithTooltip>

          {/* OCR — always visible, disabled when no PDF, amber highlight */}
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
