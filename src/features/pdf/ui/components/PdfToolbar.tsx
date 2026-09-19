import type { PdfFile } from '@shared-core/types'

import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { cn } from '@shared/lib/uiUtils'
import { ToolbarGroup } from '@shared/ui/components/primitives'

import { Hand, SlidersHorizontal, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePdfSearchStore } from '../hooks/usePdfSearchStore'
import PdfAiQuickBar from './PdfAiQuickBar'
import PdfPageNav from './PdfPageNav'
import PdfSearchBar from './PdfSearchBar'
import PdfZoomControls, { type CurrentScaleComponent, type ZoomComponent } from './PdfZoomControls'

interface PdfToolbarProps {
  pdfFile: PdfFile | null
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
  onReload?: () => void
}

function PdfToolbar({
  pdfFile,
  onStartScreenshot,
  onFullPageScreenshot,
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
  onAddCurrentPageTextToAi,
  onReload
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

  // Çift mod: 'viewer' = mevcut çubuk (Resim 2), 'actions' = sağ-tık 4'lüsü.
  // Sağ-tık menüsü ve mevcut viewer araçları aynen korunur, sadece ekleme.
  const [mode, setMode] = useState<'viewer' | 'actions'>('viewer')
  const isActionsMode = mode === 'actions'
  const handleToggleMode = useCallback(() => {
    setMode((m) => (m === 'viewer' ? 'actions' : 'viewer'))
  }, [])

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-tour-id="tour-target-pdf-toolbar"
      className="border-border/80 bg-card/90 relative flex w-full shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5 select-none sm:gap-3"
    >
      <div className="relative flex items-center gap-2">
        <ToolbarGroup>
          {isActionsMode ? (
            /* Actions modunda geri dönüş — viewer araçlarına dön */
            <WithTooltip label={t('pdf_toolbar_show_viewer')}>
              <IconButton
                type="button"
                variant="secondary"
                size="compact"
                onClick={handleToggleMode}
                aria-label={t('pdf_toolbar_show_viewer')}
                aria-pressed
                className="border-sky-500/30 bg-sky-500/15 text-sky-600 shadow-xs transition-colors dark:text-sky-400"
                data-testid="pdf-toolbar-mode-toggle"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              </IconButton>
            </WithTooltip>
          ) : (
            <>
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
              {/* AI işlemleri moduna geçiş */}
              <WithTooltip label={t('pdf_toolbar_show_ai_actions')}>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="compact"
                  onClick={handleToggleMode}
                  aria-label={t('pdf_toolbar_show_ai_actions')}
                  aria-pressed={false}
                  className="text-muted-foreground hover:text-foreground border border-transparent transition-colors hover:border-sky-500/20 hover:bg-sky-500/10"
                  data-testid="pdf-toolbar-mode-toggle"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                </IconButton>
              </WithTooltip>
            </>
          )}
        </ToolbarGroup>
      </div>

      <div className="mx-2 flex min-w-0 flex-1 items-center justify-center">
        {isActionsMode ? (
          <PdfAiQuickBar
            onAddCurrentPageTextToAi={onAddCurrentPageTextToAi}
            onSendPageAsImageToAi={onFullPageScreenshot}
            onAreaScreenshot={onStartScreenshot}
            onReload={onReload}
          />
        ) : (
          <PdfSearchBar
            isOpen={isSearchOpen}
            onToggle={handleOpenSearch}
            keyword={searchKeyword}
            onKeywordChange={handleKeywordChange}
            onSearch={handleSearch}
            onClear={handleClearSearch}
            fileName={pdfFile?.name}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        {isActionsMode ? (
          /* Yer kaplamayan salt-görünüm sayfa göstergesi */
          <ToolbarGroup
            className="px-2.5 py-1"
            data-testid="pdf-actions-page-indicator"
            role="status"
            aria-label={`${currentPage} / ${totalPages}`}
          >
            <span className="text-ql-12 text-foreground font-medium tabular-nums">
              {currentPage} <span className="text-muted-foreground/40 mx-0.5">/</span>{' '}
              <span className="text-muted-foreground">{totalPages}</span>
            </span>
          </ToolbarGroup>
        ) : (
          <>
            <PdfPageNav
              currentPage={currentPage}
              totalPages={totalPages}
              onPreviousPage={onPreviousPage}
              onNextPage={onNextPage}
              onJumpToPage={onJumpToPage}
            />
            <PdfZoomControls ZoomIn={ZoomIn} ZoomOut={ZoomOut} CurrentScale={CurrentScale} />
          </>
        )}
      </div>
    </motion.div>
  )
}

export default memo(PdfToolbar)
