import type { PdfFile } from '@shared-core/types'

import { cn } from '@shared/lib/uiUtils'
import { IconButton, ToolbarGroup, WithTooltip } from '@shared/ui/components/primitives'

import { Hand, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePdfSearchStore } from '../hooks/usePdfSearchStore'
import PdfPageNav from './PdfPageNav'
import PdfSearchBar from './PdfSearchBar'
import PdfZoomControls, { type CurrentScaleComponent, type ZoomComponent } from './PdfZoomControls'

/* Toggle states for the pan button. */
const TOGGLE_ACTIVE = 'border-ring/50 bg-accent/30 text-foreground'
const TOGGLE_IDLE =
  'border border-transparent text-muted-foreground hover:border-ring/30 hover:bg-accent/20 hover:text-foreground'

interface PdfToolbarProps {
  pdfFile: PdfFile | null
  /** @deprecated Yeni seçim menüsüyle yineleniyor; sağ tık menüsü giriş noktasıdır. */
  onStartScreenshot?: () => void
  /** @deprecated Yeni seçim menüsüyle yineleniyor; sağ tık menüsü giriş noktasıdır. */
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
  /** @deprecated Yeni seçim menüsüyle yineleniyor; sağ tık menüsü giriş noktasıdır. */
  onAddCurrentPageTextToAi?: () => void
  onReload?: () => void
}

/**
 * Sade alt araç çubuğu: sayfa gezinme + zoom + arama + pan + reload.
 *
 * Yeni ikili seçim menüsü (AI'ye Gönder / Taslağa Ekle) ile işlevi tekrar eden
 * AI gönderme ve alan/görsel seçme kontrolleri kaldırıldı. Bunlar artık seçim
 * akışı ve sağ tık menüsü üzerinden yapılır. İş mantığı silinmedi — yalnızca
 * gereksiz UI girişleri temizlendi; sağ tık menüsü ve bağımsız işlevler korunur.
 * Tam sayfa metin/görsel keşfedilebilirliği sağ tık menüsündedir.
 */
function PdfToolbar({
  pdfFile,
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
  onReload
}: PdfToolbarProps) {
  const { t } = useTranslation()
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
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
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
        } else {
          clearHighlights()
        }
      }, 300)
    },
    [clearHighlights, highlight]
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

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="border-border/60 bg-card/60 relative flex w-full shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5 select-none sm:gap-3"
    >
      <div className="relative flex items-center gap-2">
        <ToolbarGroup>
          <WithTooltip label={t('pdf_pan_mode')}>
            <IconButton
              type="button"
              variant={panMode ? 'secondary' : 'ghost'}
              size="compact"
              onClick={onTogglePanMode}
              aria-label={t('pdf_pan_mode')}
              aria-pressed={panMode}
              className={cn(
                'motion-normal transition-colors',
                panMode ? TOGGLE_ACTIVE : TOGGLE_IDLE
              )}
              data-testid="pan-mode-button"
            >
              <Hand className="size-3.5" aria-hidden="true" />
            </IconButton>
          </WithTooltip>
          {onReload && (
            <WithTooltip label={`${t('ctx_reload')} (Ctrl+R)`}>
              <IconButton
                type="button"
                variant="ghost"
                size="compact"
                onClick={onReload}
                aria-label={t('ctx_reload')}
                className={cn(TOGGLE_IDLE, 'motion-normal transition-colors')}
                data-testid="pdf-toolbar-reload"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
              </IconButton>
            </WithTooltip>
          )}
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
