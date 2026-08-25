import type { PdfTab } from '@features/pdf/hooks/types'

import { TabStripHomeButton, ToolbarButton } from '@shared/ui/components/primitives'
import { TAB_STRIP_BAR_CLASS, TAB_STRIP_ROW_CLASS } from '@shared/ui/tabStripChrome'

import { Plus } from 'lucide-react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import OverflowMenu from './OverflowMenu'
import PdfTabItem from './PdfTabItem'
import type { ContextMenuState } from './pdfTabStripUtils'
import { clamp, computeTabVisibility, getMaxVisibleTabs } from './pdfTabStripUtils'
import TabContextMenu from './TabContextMenu'
import { usePdfTabStripDerived } from './usePdfTabStripDerived'
import { usePdfTabStripRoving } from './usePdfTabStripRoving'
import { useTabEditing } from './useTabEditing'

interface PdfTabStripProps {
  tabs: PdfTab[]
  activeTabId: string
  onSetActiveTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onRenameTab: (tabId: string, title?: string) => void
  onAddTab: () => void
  onHome?: () => void
}

function PdfTabStrip({
  tabs,
  activeTabId,
  onSetActiveTab,
  onCloseTab,
  onRenameTab,
  onAddTab,
  onHome
}: PdfTabStripProps) {
  const { t, tr, getTabLabel, getTabIcon, isPdfHomeActive } = usePdfTabStripDerived(
    tabs,
    activeTabId
  )
  const renameInputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const contextMenuTriggerRef = useRef<HTMLElement | null>(null)

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(3)

  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width =
        entries[0]?.contentBoxSize?.[0]?.inlineSize ?? entries[0]?.contentRect?.width ?? 0
      if (width > 0) {
        setMaxVisibleTabs(getMaxVisibleTabs(width, !!onHome))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onHome])

  const { visibleTabs, overflowTabs } = useMemo(
    () => computeTabVisibility(tabs, activeTabId, maxVisibleTabs),
    [tabs, activeTabId, maxVisibleTabs]
  )

  const {
    editingTabId,
    editingValue,
    setEditingValue,
    beginRename: startRename,
    handleEditingBlur,
    handleEditingKeyDown,
    cancelRename
  } = useTabEditing()

  const { setTabButtonRef, handleRowKeyDown } = usePdfTabStripRoving({
    visibleTabs,
    activeTabId,
    editingTabId,
    onSetActiveTab
  })

  const beginRename = useCallback(
    (tab: PdfTab) => {
      setContextMenu(null)
      startRename(tab)
    },
    [startRename]
  )

  // Bind `onRenameTab` once so PdfTabItem's memo is not busted per render.
  const handleTabEditingBlur = useCallback(
    (tabId: string, tabTitle: string) => handleEditingBlur(tabId, tabTitle, onRenameTab),
    [handleEditingBlur, onRenameTab]
  )
  const handleTabEditingKeyDown = useCallback(
    (event: React.KeyboardEvent, tabId: string, tabTitle: string) =>
      handleEditingKeyDown(event, tabId, tabTitle, onRenameTab),
    [handleEditingKeyDown, onRenameTab]
  )

  const handleOpenContextMenu = useCallback((event: ReactMouseEvent, tabId: string) => {
    event.preventDefault()
    event.stopPropagation()

    contextMenuTriggerRef.current =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null

    setContextMenu({
      tabId,
      x: clamp(event.clientX, 12, Math.max(12, window.innerWidth - 188)),
      y: clamp(event.clientY, 12, Math.max(12, window.innerHeight - 98))
    })
  }, [])

  useEffect(() => {
    if (editingTabId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [editingTabId])

  useEffect(() => {
    if (editingTabId && !tabs.some((tab) => tab.id === editingTabId)) cancelRename()
  }, [editingTabId, tabs, cancelRename])

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
    <div className={TAB_STRIP_BAR_CLASS} data-tour-id="tour-target-pdf-tab-strip">
      <div
        ref={rowRef}
        role="tablist"
        aria-label={tr('pdf_tablist_label', 'PDF tabs')}
        className={TAB_STRIP_ROW_CLASS}
        onKeyDown={handleRowKeyDown}
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
            isEditing={editingTabId === tab.id}
            editingValue={editingTabId === tab.id ? editingValue : ''}
            getTabLabel={getTabLabel}
            getTabIcon={getTabIcon}
            tr={tr}
            onSetActiveTab={onSetActiveTab}
            onCloseTab={onCloseTab}
            onBeginRename={beginRename}
            onOpenContextMenu={handleOpenContextMenu}
            onEditingValueChange={setEditingValue}
            onEditingBlur={handleTabEditingBlur}
            onEditingKeyDown={handleTabEditingKeyDown}
            renameInputRef={editingTabId === tab.id ? renameInputRef : undefined}
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
        onBeginRename={beginRename}
        onCloseTab={onCloseTab}
        onDismiss={() => setContextMenu(null)}
        triggerRef={contextMenuTriggerRef}
      />
    </div>
  )
}

export default memo(PdfTabStrip)
