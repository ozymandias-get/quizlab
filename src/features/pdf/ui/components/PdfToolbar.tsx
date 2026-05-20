import { memo, useState, useCallback, useRef, type ComponentType, type ReactElement } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  Hand,
  Crop,
  Image as ImageIcon,
  Send,
  ChevronLeft,
  ChevronRight,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Type
} from 'lucide-react'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import PdfSearchBar from './PdfSearchBar'
import type { PdfFile } from '@shared-core/types'
import { ToolbarButton } from '@shared/ui/components/primitives'
import { Button } from '@ui/components/button'

interface RenderChildProps {
  onClick: () => void
  scale?: number
}

type ZoomComponent = ComponentType<{ children: (props: RenderChildProps) => ReactElement }>
type CurrentScaleComponent = ComponentType<{ children: (props: { scale: number }) => ReactElement }>

interface PdfToolbarProps {
  pdfFile: PdfFile | null
  onSelectPdf: () => void
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
  highlight: (keyword: string) => void
  clearHighlights: () => void
  ZoomIn: ZoomComponent
  ZoomOut: ZoomComponent
  CurrentScale: CurrentScaleComponent
  onAddCurrentPageTextToAi?: () => void
}

function PdfToolbar({
  pdfFile,
  onSelectPdf,
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
  highlight,
  clearHighlights,
  ZoomIn,
  ZoomOut,
  CurrentScale,
  onAddCurrentPageTextToAi
}: PdfToolbarProps) {
  const { t } = useLanguageStrings()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }
    if (searchKeyword.trim()) {
      highlight(searchKeyword)
    }
  }, [searchKeyword, highlight])

  const handleClearSearch = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }
    setIsSearchOpen(false)
    setSearchKeyword('')
    clearHighlights()
  }, [clearHighlights])

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex-shrink-0 relative z-50 flex w-full items-center justify-between gap-3 border-t border-white/[0.08] bg-gradient-to-t from-[#05070d] via-[#05070d]/95 to-transparent px-6 py-3 select-none"
    >
      <div className="flex items-center gap-1.5">
        <div className="glass-tier-3 glass-tier-toolbar flex items-center gap-1 p-1.5">
          <ToolbarButton
            onClick={onAddCurrentPageTextToAi}
            icon={Type}
            tooltip={t('pdf_add_current_page_text_to_ai')}
            className="text-violet-400/80 hover:text-violet-300 hover:bg-violet-500/10 hover:shadow-[0_0_15px_-5px_rgba(139,92,246,0.3)]"
          />

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5" />

          <ToolbarButton
            onClick={onTogglePanMode}
            icon={Hand}
            tooltip={t('pdf_pan_mode')}
            isActive={panMode}
            activeClassName="bg-gradient-to-br from-sky-900 to-cyan-950 text-white shadow-[0_0_18px_-6px_rgba(34,97,148,0.35)]"
            className="text-sky-500/70 hover:text-sky-300 hover:bg-sky-900/30"
          />

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5" />

          <ToolbarButton
            onClick={onStartScreenshot}
            icon={Crop}
            tooltip={t('screenshot')}
            className="text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 hover:shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]"
          />
          <ToolbarButton
            onClick={onFullPageScreenshot}
            icon={ImageIcon}
            tooltip={t('full_page_screenshot')}
            className="text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/10 hover:shadow-[0_0_15px_-5px_rgba(52,211,153,0.3)]"
          />
        </div>

        <div className="glass-tier-3 glass-tier-toolbar flex items-center gap-1 p-1.5">
          <ToolbarButton
            onClick={onToggleAutoSend}
            icon={Send}
            tooltip={autoSend ? t('auto_send_on') : t('auto_send_off')}
            isActive={autoSend}
            activeClassName="bg-gradient-to-br from-indigo-800 to-violet-900 text-white shadow-[0_0_18px_-6px_rgba(76,84,164,0.34)]"
          />
          <ToolbarButton
            onClick={onSelectPdf}
            icon={Upload}
            tooltip={t('select_pdf')}
            className="text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
          />
        </div>
      </div>

      <div className="flex-1 mx-2 min-w-0 flex justify-center items-center">
        <PdfSearchBar
          isOpen={isSearchOpen}
          onToggle={() => setIsSearchOpen(true)}
          keyword={searchKeyword}
          onKeywordChange={(value) => {
            setSearchKeyword(value)
            scheduleHighlight(value)
          }}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          fileName={pdfFile?.name}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="glass-tier-3 glass-tier-toolbar flex items-center gap-1 p-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPreviousPage}
            disabled={currentPage <= 1}
            className="w-8 h-8 rounded-xl hover:bg-white/[0.08] disabled:opacity-25 disabled:hover:bg-transparent transition-colors duration-200 text-white/50 hover:text-white"
            title={t('prev_page')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <span className="px-3 text-ql-12 font-medium text-white/70 min-w-[60px] text-center select-none tabular-nums">
            {currentPage} <span className="text-white/20 mx-0.5">/</span> {totalPages}
          </span>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="w-8 h-8 rounded-xl hover:bg-white/[0.08] disabled:opacity-25 disabled:hover:bg-transparent transition-colors duration-200 text-white/50 hover:text-white"
            title={t('next_page')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="glass-tier-3 glass-tier-toolbar flex items-center gap-1 p-1.5">
          <ZoomOut>
            {(props: RenderChildProps) => (
              <Button
                variant="ghost"
                size="icon"
                onClick={props.onClick}
                className="w-8 h-8 rounded-xl hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors duration-200"
                title={t('zoom_out')}
              >
                <ZoomOutIcon className="w-4 h-4" />
              </Button>
            )}
          </ZoomOut>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <CurrentScale>
            {(props: { scale: number }) => (
              <div className="glass-tier-3 rounded-lg border-amber-400/18 bg-[linear-gradient(145deg,rgba(245,158,11,0.12),rgba(255,255,255,0.03))] px-2 py-1">
                <span className="text-ql-12 font-semibold text-amber-400 min-w-[40px] text-center tabular-nums select-none">
                  {Math.round(props.scale * 100)}%
                </span>
              </div>
            )}
          </CurrentScale>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <ZoomIn>
            {(props: RenderChildProps) => (
              <Button
                variant="ghost"
                size="icon"
                onClick={props.onClick}
                className="w-8 h-8 rounded-xl hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors duration-200"
                title={t('zoom_in')}
              >
                <ZoomInIcon className="w-4 h-4" />
              </Button>
            )}
          </ZoomIn>
        </div>
      </div>
    </motion.div>
  )
}

export default memo(PdfToolbar)
