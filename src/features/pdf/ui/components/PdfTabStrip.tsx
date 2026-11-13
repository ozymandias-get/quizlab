import type { PdfTab } from '@features/pdf/hooks/types'

import { useAppearance } from '@app/providers'
import { useTabStripReorder } from '@shared/hooks'
import { cn } from '@shared/lib/uiUtils'
import { TabStripHomeButton, ToolbarButton } from '@shared/ui/components/primitives'
import { TAB_STRIP_BAR_CLASS, TAB_STRIP_ROW_CLASS } from '@shared/ui/tabStripChrome'

import { Plus } from 'lucide-react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import OverflowMenu from './OverflowMenu'
import PdfTabItem from './PdfTabItem'
import type { ContextMenuState } from './pdfTabStripUtils'
import {
  computeTabVisibility,
  getDesiredPdfTabWidth,
  getMaxVisibleTabs,
  getPdfTabStripChromeWidth,
  resolveVisiblePdfTabCount
} from './pdfTabStripUtils'
import TabContextMenu from './TabContextMenu'
import { usePdfTabStripDerived } from './usePdfTabStripDerived'
import { usePdfTabStripRoving } from './usePdfTabStripRoving'

interface PdfTabStripProps {
  tabs: PdfTab[]
  activeTabId: string
  onSetActiveTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onMoveTab: (tabId: string, targetId: string, placeAfter: boolean) => void
  onAddTab: () => void
  onHome?: () => void
}

function PdfTabStrip({
  tabs,
  activeTabId,
  onSetActiveTab,
  onCloseTab,
  onMoveTab,
  onAddTab,
  onHome
}: PdfTabStripProps) {
  const { t, tr, getTabLabel, getTabIcon, isPdfHomeActive } = usePdfTabStripDerived(
    tabs,
    activeTabId
  )
  const isLayoutSwapped = useAppearance((s) => s.isLayoutSwapped)
  const rowRef = useRef<HTMLDivElement>(null)
  const contextMenuTriggerRef = useRef<HTMLElement | null>(null)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(3)
  const previousTabCountRef = useRef(tabs.length)

  // Closing a tab unmounts the focused close/pill button. If the browser drops
  // focus to the body, move it to the newly active tab instead of leaving the
  // strip without a focus target.
  useEffect(() => {
    const previousCount = previousTabCountRef.current
    previousTabCountRef.current = tabs.length
    if (tabs.length >= previousCount) return

    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    rowRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
  }, [tabs.length])

  const getInitialCapacity = useCallback(
    (width: number) => {
      // Reserve the overflow button only when there really will be an
      // overflow: before it is rendered it consumes no row space.
      const withoutOverflow = getMaxVisibleTabs(width, !!onHome, { hasOverflow: false })
      return tabsRef.current.length > withoutOverflow
        ? getMaxVisibleTabs(width, !!onHome, { hasOverflow: true })
        : withoutOverflow
    },
    [onHome]
  )

  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width =
        entries[0]?.contentBoxSize?.[0]?.inlineSize ?? entries[0]?.contentRect?.width ?? 0
      if (width > 0) {
        setMaxVisibleTabs(getInitialCapacity(width))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [getInitialCapacity])

  // Opening, closing or renaming a tab changes how much room the pills need.
  // Reset to the width-based estimate; the measurement pass below trims it.
  const tabContentSignature = tabs
    .map((tab) => `${tab.id}:${tab.title ?? ''}:${tab.file?.name ?? ''}`)
    .join('|')
  const lastTabContentSignatureRef = useRef(tabContentSignature)
  useLayoutEffect(() => {
    if (lastTabContentSignatureRef.current === tabContentSignature) return
    lastTabContentSignatureRef.current = tabContentSignature

    const width = rowRef.current?.clientWidth ?? 0
    if (width > 0) setMaxVisibleTabs(getInitialCapacity(width))
  }, [getInitialCapacity, tabContentSignature])

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row || row.clientWidth <= 0) return

    const renderedTabs = [...row.querySelectorAll<HTMLElement>('[data-pdf-tab]')]
    if (renderedTabs.length === 0 && maxVisibleTabs > 0) return

    // `clientWidth` includes the row's horizontal padding; the ResizeObserver
    // path measures the content box, so remove the padding here too.
    const style = window.getComputedStyle(row)
    const contentWidth =
      row.clientWidth -
      (Number.parseFloat(style.paddingLeft) || 0) -
      (Number.parseFloat(style.paddingRight) || 0)
    const hasOverflow = tabs.length > renderedTabs.length
    const available = contentWidth - getPdfTabStripChromeWidth(!!onHome, hasOverflow)
    const tabWidths = renderedTabs.map((tab) => {
      const label = tab.querySelector<HTMLElement>('[data-pdf-tab-label]')
      const clippedText = label ? Math.max(0, label.scrollWidth - label.clientWidth) : 0
      return getDesiredPdfTabWidth(tab.offsetWidth, clippedText)
    })

    const next = resolveVisiblePdfTabCount({
      current: maxVisibleTabs,
      tabWidths,
      availableWidth: available,
      hasOverflow
    })
    if (next !== maxVisibleTabs) setMaxVisibleTabs(next)
  }, [maxVisibleTabs, tabs, activeTabId, onHome])

  const { visibleTabs, overflowTabs } = useMemo(
    () => computeTabVisibility(tabs, activeTabId, maxVisibleTabs),
    [tabs, activeTabId, maxVisibleTabs]
  )

  const { draggedId, dropTarget, rowDragHandlers } = useTabStripReorder({ onReorder: onMoveTab })

  const { setTabButtonRef, handleRowKeyDown } = usePdfTabStripRoving({
    visibleTabs,
    activeTabId,
    onSetActiveTab
  })

  const handleOpenContextMenu = useCallback((event: ReactMouseEvent, tabId: string) => {
    event.preventDefault()
    event.stopPropagation()

    contextMenuTriggerRef.current =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null

    // The menu measures itself and clamps to the viewport, so translated or
    // scaled menus cannot overflow.
    setContextMenu({
      tabId,
      x: event.clientX,
      y: event.clientY
    })
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!contextMenu) return
      const menuEl = document.getElementById('tab-context-menu')
      if (menuEl && !menuEl.contains(event.target as Node)) setContextMenu(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [contextMenu])

  if (!tabs || tabs.length === 0) return null

  const contextMenuTab = contextMenu ? tabs.find((tab) => tab.id === contextMenu.tabId) : undefined

  return (
    <div
      className={cn(TAB_STRIP_BAR_CLASS, isLayoutSwapped && 'window-controls-safe')}
      data-window-edge={isLayoutSwapped ? undefined : 'left'}
    >
      <div
        ref={rowRef}
        role="tablist"
        aria-label={tr('pdf_tablist_label', 'PDF tabs')}
        className={TAB_STRIP_ROW_CLASS}
        onKeyDown={handleRowKeyDown}
        {...rowDragHandlers}
      >
        {onHome && (
          <TabStripHomeButton
            isActive={isPdfHomeActive}
            tooltip={t('ai_home.home')}
            onClick={onHome}
            className="rounded-full"
          />
        )}
        {visibleTabs.map((tab) => (
          <PdfTabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            isDragging={draggedId === tab.id}
            dropSide={
              dropTarget?.tabId === tab.id ? (dropTarget.placeAfter ? 'after' : 'before') : null
            }
            getTabLabel={getTabLabel}
            getTabIcon={getTabIcon}
            tr={tr}
            onSetActiveTab={onSetActiveTab}
            onCloseTab={onCloseTab}
            onOpenContextMenu={handleOpenContextMenu}
            buttonRef={setTabButtonRef}
          />
        ))}

        {overflowTabs.length > 0 && (
          <OverflowMenu
            overflowTabs={overflowTabs}
            getTabLabel={getTabLabel}
            getTabIcon={getTabIcon}
            tr={tr}
            onSetActiveTab={onSetActiveTab}
            onCloseTab={onCloseTab}
            onOpenContextMenu={handleOpenContextMenu}
          />
        )}

        <div className="shrink-0">
          <ToolbarButton
            icon={Plus}
            tooltip={t('add_pdf')}
            onClick={onAddTab}
            className="rounded-full"
          />
        </div>
      </div>

      <TabContextMenu
        contextMenu={contextMenu}
        tab={contextMenuTab}
        tr={tr}
        onCloseTab={onCloseTab}
        onDismiss={() => setContextMenu(null)}
        triggerRef={contextMenuTriggerRef}
      />
    </div>
  )
}

export default memo(PdfTabStrip)
