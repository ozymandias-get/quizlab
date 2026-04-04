import {
  memo,
  useState,
  useCallback,
  type ComponentType,
  type ElementType,
  type ReactElement
} from 'react'
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
  ZoomOut as ZoomOutIcon
} from 'lucide-react'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import PdfSearchBar from './PdfSearchBar'
import type { PdfFile } from '@shared-core/types'
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
  CurrentScale
}: PdfToolbarProps) {
  const { t } = useLanguageStrings()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')

  const handleSearch = useCallback(() => {
    if (searchKeyword.trim()) {
      highlight(searchKeyword)
    }
  }, [searchKeyword, highlight])

  const handleClearSearch = useCallback(() => {
    setIsSearchOpen(false)
    setSearchKeyword('')
    clearHighlights()
  }, [clearHighlights])

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex-shrink-0 w-full bg-gradient-to-t from-[#050505] via-[#050505] to-[#080808] border-t border-white/[0.06] px-6 py-3 relative z-50 flex items-center justify-between gap-4 select-none"
    >
      {/* Left: Tools Island */}
      <div className="glass-surface glass-surface--toolbar flex items-center gap-1 p-1.5">
        <ToolbarButton onClick={onSelectPdf} icon={Upload} tooltip={t('select_pdf')} />

        <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-0.5" />
        <ToolbarButton
          onClick={onTogglePanMode}
          icon={Hand}
          tooltip={t('pdf_pan_mode')}
          isActive={panMode}
          activeClassName="bg-gradient-to-br from-sky-600 to-cyan-700 text-white shadow-[0_0_18px_-4px_rgba(34,211,238,0.55)]"
          className="text-sky-400/80 hover:text-sky-200 hover:bg-sky-500/15"
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
        <ToolbarButton
          onClick={onToggleAutoSend}
          icon={Send}
          tooltip={autoSend ? t('auto_send_on') : t('auto_send_off')}
          isActive={autoSend}
          activeClassName="bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]"
        />
      </div>

      {/* Center: File Info & Search */}
      <div className="flex-1 mx-2 min-w-0 flex justify-center items-center">
        <PdfSearchBar
          isOpen={isSearchOpen}
          onToggle={() => setIsSearchOpen(true)}
          keyword={searchKeyword}
          onKeywordChange={setSearchKeyword}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          fileName={pdfFile?.name}
        />
      </div>

      {/* Right: Navigation & Zoom Groups */}
      <div className="flex items-center gap-2">
        {/* Navigation Island */}
        <div className="glass-surface glass-surface--toolbar flex items-center gap-1 p-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPreviousPage}
            disabled={currentPage <= 1}
            className="w-8 h-8 rounded-xl hover:bg-white/[0.08] disabled:opacity-25 disabled:hover:bg-transparent transition-all duration-300 text-white/50 hover:text-white"
            title={t('prev_page')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <span className="px-3 text-xs font-medium text-white/70 min-w-[60px] text-center select-none tabular-nums">
            {currentPage} <span className="text-white/20 mx-0.5">/</span> {totalPages}
          </span>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="w-8 h-8 rounded-xl hover:bg-white/[0.08] disabled:opacity-25 disabled:hover:bg-transparent transition-all duration-300 text-white/50 hover:text-white"
            title={t('next_page')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Zoom Island */}
        <div className="glass-surface glass-surface--toolbar flex items-center gap-1 p-1.5">
          <ZoomOut>
            {(props: RenderChildProps) => (
              <Button
                variant="ghost"
                size="icon"
                onClick={props.onClick}
                className="w-8 h-8 rounded-xl hover:bg-white/[0.08] text-white/50 hover:text-white transition-all duration-300"
                title={t('zoom_out')}
              >
                <ZoomOutIcon className="w-4 h-4" />
              </Button>
            )}
          </ZoomOut>

          <div className="w-px h-5 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <CurrentScale>
            {(props: { scale: number }) => (
              <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/15">
                <span className="text-xs font-semibold text-amber-400 min-w-[40px] text-center tabular-nums select-none">
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
                className="w-8 h-8 rounded-xl hover:bg-white/[0.08] text-white/50 hover:text-white transition-all duration-300"
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

interface ToolbarButtonProps {
  onClick: () => void
  icon: ElementType
  tooltip: string
  isActive?: boolean
  className?: string
  activeClassName?: string
}

function ToolbarButton({
  onClick,
  icon: Icon,
  tooltip,
  isActive,
  className,
  activeClassName
}: ToolbarButtonProps) {
  return (
    <Button
      variant={isActive ? 'default' : 'ghost'}
      size="icon"
      onClick={onClick}
      title={tooltip}
      className={`
                w-8 h-8 rounded-xl transition-all duration-300
                ${
                  isActive
                    ? activeClassName || 'bg-white/15 text-white shadow-lg'
                    : className || 'text-white/40 hover:text-white hover:bg-white/[0.08]'
                }
            `}
      asChild
    >
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}>
        <Icon className="w-4 h-4" />
      </motion.button>
    </Button>
  )
}

export default memo(PdfToolbar)
