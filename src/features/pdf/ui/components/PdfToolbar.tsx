import type { PdfFile } from '@shared-core/types'

import { MenuItem, MenuSurface } from '@app/components/ui/menu'
import { cn } from '@shared/lib/uiUtils'
import { IconButton, ToolbarGroup, WithTooltip } from '@shared/ui/components/primitives'

import { Hand, MoreHorizontal, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

import { pdfDocumentId } from '../hooks/pdfDocumentIdentity'
import { usePdfSearchStore } from '../hooks/usePdfSearchStore'
import PdfPageNav from './PdfPageNav'
import PdfSearchBar from './PdfSearchBar'
import PdfZoomControls, { type CurrentScaleComponent, type ZoomComponent } from './PdfZoomControls'

/* Toggle states for the pan button. */
const TOGGLE_ACTIVE = 'border-ring/50 bg-accent/30 text-foreground'
const TOGGLE_IDLE =
  'border border-transparent text-muted-foreground hover:border-ring/30 hover:bg-accent/20 hover:text-foreground'

type MenuVertical = 'top' | 'bottom'
type MenuHorizontal = 'left' | 'right'

/** Gap between the compact menu and its trigger, in pixels. */
const MENU_GAP = 8

/**
 * The search store is shared by every mounted toolbar (workspace + focus
 * overlay overlap during the focus transition). Only the last toolbar leaving
 * may reset it, or the exiting copy would close the surviving viewer's search.
 */
let mountedToolbarCount = 0

interface PdfToolbarProps {
  pdfFile: PdfFile | null
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
  const documentId = pdfDocumentId(pdfFile)
  const storeSearchOpen = usePdfSearchStore((s) => s.isOpen)
  const storeSearchKeyword = usePdfSearchStore((s) => s.keyword)
  const searchOwnerId = usePdfSearchStore((s) => s.ownerId)
  const openSearch = usePdfSearchStore((s) => s.open)
  const setSearchKeyword = usePdfSearchStore((s) => s.setKeyword)
  const resetSearch = usePdfSearchStore((s) => s.reset)
  const resetSearchForOwner = usePdfSearchStore((s) => s.resetOwner)
  // A viewer only mirrors the shared query while it belongs to its document.
  // `null` means the shortcut opened the bar without a document yet.
  const ownsSearch = searchOwnerId === null || searchOwnerId === documentId
  const isSearchOpen = storeSearchOpen && ownsSearch
  const searchKeyword = ownsSearch ? storeSearchKeyword : ''
  const searchKeywordRef = useRef(searchKeyword)
  searchKeywordRef.current = searchKeyword
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isCompactMenuOpen, setIsCompactMenuOpen] = useState(false)
  const [compactMenuVertical, setCompactMenuVertical] = useState<MenuVertical>('top')
  const [compactMenuHorizontal, setCompactMenuHorizontal] = useState<MenuHorizontal>('left')
  const compactMenuRef = useRef<HTMLDivElement>(null)
  const compactMenuTriggerRef = useRef<HTMLButtonElement>(null)

  const closeCompactMenu = useCallback((returnFocus = false) => {
    setIsCompactMenuOpen(false)
    if (returnFocus) compactMenuTriggerRef.current?.focus()
  }, [])

  // WAI-ARIA menu button: focus moves to the first item on open and returns to
  // the trigger on Escape/selection; outside clicks just dismiss.
  useEffect(() => {
    if (!isCompactMenuOpen) return
    const menu = compactMenuRef.current?.querySelector<HTMLElement>('[role="menu"]')
    menu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    // Keep the menu inside the visible toolbar band: prefer opening upward,
    // but flip below the trigger (and to the other edge horizontally) when the
    // available space is too small. jsdom reports zero sizes, in which case the
    // defaults stay in place.
    const trigger = compactMenuTriggerRef.current
    if (trigger && menu) {
      const triggerRect = trigger.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      const spaceAbove = triggerRect.top
      const spaceBelow = window.innerHeight - triggerRect.bottom
      const nextVertical: MenuVertical =
        spaceAbove >= menuRect.height + MENU_GAP || spaceAbove > spaceBelow ? 'top' : 'bottom'

      // The menu is left-aligned by default. If that would cross the left
      // viewport edge but there is room to the right, align its right edge with
      // the trigger instead.
      const spaceToLeft = triggerRect.left
      const spaceToRight = window.innerWidth - triggerRect.right
      const overflowsLeft = menuRect.width > 0 && spaceToLeft < menuRect.width + MENU_GAP
      const canFlipRight = spaceToRight >= menuRect.width + MENU_GAP

      setCompactMenuVertical(nextVertical)
      setCompactMenuHorizontal(overflowsLeft && canFlipRight ? 'right' : 'left')
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!compactMenuRef.current?.contains(event.target as Node)) {
        closeCompactMenu()
      }
    }
    // Escape is handled only by the menu's React handler. A second document
    // listener would let the same key also close the surrounding layer.
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [closeCompactMenu, isCompactMenuOpen])

  const handleCompactMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeCompactMenu(true)
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const items = [
        ...(compactMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
      ]
      if (items.length === 0) return
      event.preventDefault()
      const currentIndex = items.indexOf(document.activeElement as HTMLElement)
      if (event.key === 'Home') {
        items[0].focus()
      } else if (event.key === 'End') {
        items[items.length - 1].focus()
      } else {
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const nextIndex = (currentIndex + delta + items.length) % items.length
        items[nextIndex].focus()
      }
    },
    [closeCompactMenu]
  )

  // The document identity is the same value the viewer uses for page edits:
  // path alone misses a reopened file whose stream/content changed.
  const documentIdRef = useRef(documentId)
  useEffect(() => {
    if (documentId === documentIdRef.current) return
    const previousDocumentId = documentIdRef.current
    documentIdRef.current = documentId
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }
    resetSearchForOwner(previousDocumentId)
    clearHighlights()
  }, [documentId, resetSearchForOwner, clearHighlights])

  useEffect(() => {
    mountedToolbarCount += 1
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
      mountedToolbarCount -= 1
      // Search is document-scoped state in a module store; without this close
      // a reopened viewer inherited the previous document's open search bar.
      // Wait for the last viewer: LeftPanel and FocusOverlay can overlap.
      if (mountedToolbarCount === 0) resetSearch()
    }
  }, [resetSearch])

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
    resetSearchForOwner(documentId)
    clearHighlights()
  }, [resetSearchForOwner, documentId, clearHighlights])

  const handleOpenSearch = useCallback(() => openSearch(documentId), [openSearch, documentId])

  const handleKeywordChange = useCallback(
    (keyword: string) => {
      setSearchKeyword(keyword, documentId)
      // Emptying the field is an explicit clear, not an edit to debounce: the
      // highlights must disappear with the text (same as the panel's X).
      if (!keyword) {
        if (searchDebounceRef.current) {
          clearTimeout(searchDebounceRef.current)
          searchDebounceRef.current = null
        }
        clearHighlights()
        return
      }
      scheduleHighlight(keyword)
    },
    [clearHighlights, documentId, scheduleHighlight, setSearchKeyword]
  )

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      // AI dock artık görüntüleme alanının üzerine binen yüzen bir kart; bu
      // satır onun altında kendi bandı olarak kalır. Yüzey yine de kendi daha
      // açık tonunu (`bg-card/60`) korur: iki yüzey bitişik olduğunda bile tek
      // kart gibi okunmamalı, aralarında kalan hava ikisini ayırır. Araç çubuğunun
      // içindeki kontrollerin görünümü değişmemiştir.
      className="border-border bg-card/60 @container relative flex w-full shrink-0 items-center justify-between gap-2 border-t px-2 py-2.5 select-none sm:gap-3 sm:px-4"
    >
      {/* Secondary controls yield first on narrow toolbars; page navigation,
          zoom and search stay reachable. Container queries follow the viewer
          width, not the app window, so the compact layout also applies when
          the reader sits in a narrow split pane. */}
      <div className="relative flex shrink-0 items-center gap-2">
        <ToolbarGroup className="@max-[560px]:hidden">
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

        {/* Narrow viewers keep the secondary tools in a menu instead of
            dropping them: page navigation, zoom and search remain inline. */}
        <div ref={compactMenuRef} className="relative @min-[560px]:hidden">
          <WithTooltip label={t('pdf_more_tools')}>
            <IconButton
              ref={compactMenuTriggerRef}
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => setIsCompactMenuOpen((open) => !open)}
              aria-label={t('pdf_more_tools')}
              aria-haspopup="menu"
              aria-expanded={isCompactMenuOpen}
              className={cn(TOGGLE_IDLE, 'motion-normal transition-colors')}
              data-testid="pdf-toolbar-more"
            >
              <MoreHorizontal className="size-3.5" aria-hidden="true" />
            </IconButton>
          </WithTooltip>
          {isCompactMenuOpen && (
            <MenuSurface
              className={cn(
                'z-dropdown absolute w-48',
                compactMenuVertical === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                compactMenuHorizontal === 'left' ? 'left-0' : 'right-0'
              )}
              onKeyDown={handleCompactMenuKeyDown}
            >
              <MenuItem
                icon={<Hand />}
                aria-pressed={panMode}
                onClick={() => {
                  onTogglePanMode()
                  closeCompactMenu(true)
                }}
              >
                {t('pdf_pan_mode')}
              </MenuItem>
              {onReload && (
                <MenuItem
                  icon={<RefreshCw />}
                  onClick={() => {
                    onReload()
                    closeCompactMenu(true)
                  }}
                >
                  {t('ctx_reload')}
                </MenuItem>
              )}
            </MenuSurface>
          )}
        </div>
      </div>

      <div className="mx-1 flex min-w-0 flex-1 items-center justify-center sm:mx-2">
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

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <PdfPageNav
          currentPage={currentPage}
          totalPages={totalPages}
          documentId={documentId}
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
