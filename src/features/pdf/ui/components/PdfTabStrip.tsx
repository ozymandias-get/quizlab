import type { PdfTab } from '@features/pdf/hooks/types'

import { TabStripHomeButton, ToolbarButton } from '@shared/ui/components/primitives'
import { TAB_STRIP_BAR_CLASS, TAB_STRIP_ROW_CLASS } from '@shared/ui/tabStripChrome'
import { getAiIcon } from '@ui/components/Icons'

import { FileText, Plus } from 'lucide-react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

import OverflowMenu from './OverflowMenu'
import PdfTabItem from './PdfTabItem'
import TabContextMenu from './TabContextMenu'
import { useTabEditing } from './useTabEditing'

const MIN_TAB_WIDTH = 140
const HOME_BUTTON_WIDTH = 32
const ADD_BUTTON_WIDTH = 32
const OVERFLOW_BUTTON_WIDTH = 44

interface PdfTabStripProps {
  tabs: PdfTab[]
  activeTabId: string
  onSetActiveTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onRenameTab: (tabId: string, title?: string) => void
  onAddTab: () => void
  onHome?: () => void
}

interface ContextMenuState {
  tabId: string
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function getMaxVisibleTabs(containerWidth: number, hasHome: boolean): number {
  const reservedButtons =
    (hasHome ? HOME_BUTTON_WIDTH : 0) + ADD_BUTTON_WIDTH + OVERFLOW_BUTTON_WIDTH
  const gapCount = 2
  const gapsWidth = gapCount * 8
  const available = containerWidth - reservedButtons - gapsWidth
  return Math.max(1, Math.floor(available / MIN_TAB_WIDTH))
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
  const { t } = useTranslation()
  const renameInputRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

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

  const visibleTabIds = useMemo(() => {
    if (!tabs) return new Set<string>()
    const max = maxVisibleTabs
    if (tabs.length <= max) {
      return new Set(tabs.map((tab) => tab.id))
    }
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId)
    if (activeIndex <= 0) {
      return new Set(tabs.slice(0, max).map((tab) => tab.id))
    }
    if (activeIndex >= tabs.length - 1) {
      return new Set(tabs.slice(-max).map((tab) => tab.id))
    }
    const half = Math.floor((max - 1) / 2)
    const start = Math.max(0, activeIndex - half)
    const end = Math.min(tabs.length, start + max)
    return new Set(tabs.slice(start, end).map((tab) => tab.id))
  }, [tabs, activeTabId, maxVisibleTabs])
  const { visibleTabs, overflowTabs } = useMemo(() => {
    const nextVisibleTabs: PdfTab[] = []
    const nextOverflowTabs: PdfTab[] = []

    for (const tab of tabs) {
      if (visibleTabIds.has(tab.id)) {
        nextVisibleTabs.push(tab)
        continue
      }
      nextOverflowTabs.push(tab)
    }

    return { visibleTabs: nextVisibleTabs, overflowTabs: nextOverflowTabs }
  }, [tabs, visibleTabIds])

  const pdfHomeTabId = useMemo(() => {
    if (!tabs || tabs.length === 0) return ''
    const landing = tabs.find((tab) => !tab.file && tab.kind !== 'drive')
    return landing?.id ?? ''
  }, [tabs])

  const isPdfHomeActive = pdfHomeTabId !== '' && activeTabId === pdfHomeTabId

  const tr = useCallback(
    (key: string, fallback: string) => {
      const translated = t(key)
      return translated === key ? fallback : translated
    },
    [t]
  )

  const getTabLabel = useCallback(
    (tab: PdfTab) => tab.title || tab.file?.name || tr('new_tab_title', 'New Tab'),
    [tr]
  )

  const getTabIcon = useCallback((tab: PdfTab) => {
    if (tab.kind === 'drive') {
      return getAiIcon('gdrive') || <FileText className="h-3.5 w-3.5 shrink-0 text-white/85" />
    }
    return <FileText className="h-3.5 w-3.5 shrink-0 text-white/85" />
  }, [])

  const {
    editingTabId,
    editingValue,
    setEditingValue,
    beginRename: startRename,
    handleEditingBlur,
    handleEditingKeyDown,
    cancelRename
  } = useTabEditing()

  const beginRename = useCallback(
    (tab: PdfTab) => {
      setContextMenu(null)
      startRename(tab)
    },
    [startRename]
  )

  // Stable handlers that bind `onRenameTab` once. Without these, the parent
  // would re-create new arrow functions on every render, busting `PdfTabItem`'s
  // memo and re-rendering every open tab (and its tooltip/listener wiring) on
  // every parent state change (e.g. contextMenu toggle, editing focus, etc.).
  const handleTabEditingBlur = useCallback(
    (tabId: string, value: string) => handleEditingBlur(tabId, value, onRenameTab),
    [handleEditingBlur, onRenameTab]
  )
  const handleTabEditingKeyDown = useCallback(
    (event: React.KeyboardEvent, tabId: string, value: string) =>
      handleEditingKeyDown(event, tabId, value, onRenameTab),
    [handleEditingKeyDown, onRenameTab]
  )

  const handleOpenContextMenu = useCallback((event: ReactMouseEvent, tabId: string) => {
    event.preventDefault()
    event.stopPropagation()

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    setContextMenu({
      tabId,
      x: clamp(event.clientX, 12, Math.max(12, viewportWidth - 188)),
      y: clamp(event.clientY, 12, Math.max(12, viewportHeight - 98))
    })
  }, [])

  useEffect(() => {
    if (editingTabId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [editingTabId])

  useEffect(() => {
    if (editingTabId && !tabs.some((tab) => tab.id === editingTabId)) {
      cancelRename()
    }
  }, [editingTabId, tabs, cancelRename])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (contextMenu) {
        const menuEl = document.getElementById('tab-context-menu')
        if (menuEl && !menuEl.contains(target)) {
          setContextMenu(null)
        }
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [contextMenu])

  if (!tabs || tabs.length === 0) return null

  const contextMenuTab = contextMenu ? tabs.find((tab) => tab.id === contextMenu.tabId) : undefined

  return (
    <div className={TAB_STRIP_BAR_CLASS} data-tour-id="tour-target-pdf-tab-strip">
      <div ref={rowRef} className={TAB_STRIP_ROW_CLASS}>
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
            className="text-white/75 hover:bg-white/[0.08] hover:text-white"
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
      />
    </div>
  )
}

export default memo(PdfTabStrip)
