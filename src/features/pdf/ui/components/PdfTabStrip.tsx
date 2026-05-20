import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { FileText, Plus } from 'lucide-react'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import type { PdfTab } from '@features/pdf/hooks/usePdfSelection'
import { getAiIcon } from '@ui/components/Icons'
import { TAB_STRIP_BAR_CLASS, TAB_STRIP_ROW_CLASS } from '@shared/ui/tabStripChrome'
import { TabStripHomeButton, ToolbarButton } from '@shared/ui/components/primitives'
import PdfTabItem from './PdfTabItem'
import OverflowMenu from './OverflowMenu'
import TabContextMenu from './TabContextMenu'
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

interface ContextMenuState {
  tabId: string
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const getVisibleTabIds = (tabs: PdfTab[], activeTabId: string): Set<string> => {
  if (!tabs || tabs.length <= 3) {
    return new Set((tabs || []).map((tab) => tab.id))
  }

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId)
  if (activeIndex <= 0) {
    return new Set([tabs[0].id, tabs[1].id, tabs[2].id])
  }

  if (activeIndex >= (tabs?.length || 0) - 1) {
    const last = (tabs?.length || 0) - 1
    return new Set([tabs[last - 2].id, tabs[last - 1].id, tabs[last].id])
  }

  return new Set([tabs[activeIndex - 1].id, tabs[activeIndex].id, tabs[activeIndex + 1].id])
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
  const { t } = useLanguageStrings()
  const renameInputRef = useRef<HTMLInputElement>(null)

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const visibleTabIds = useMemo(() => getVisibleTabIds(tabs, activeTabId), [tabs, activeTabId])
  const { visibleTabs, overflowTabs } = useMemo(() => {
    const nextVisibleTabs: PdfTab[] = []
    const nextOverflowTabs: PdfTab[] = []

    tabs.forEach((tab) => {
      if (visibleTabIds.has(tab.id)) {
        nextVisibleTabs.push(tab)
        return
      }
      nextOverflowTabs.push(tab)
    })

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
      return getAiIcon('gdrive') || <FileText className="w-3.5 h-3.5 shrink-0 text-white/85" />
    }
    return <FileText className="w-3.5 h-3.5 shrink-0 text-white/85" />
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
    <div className={TAB_STRIP_BAR_CLASS}>
      <div className={TAB_STRIP_ROW_CLASS}>
        {onHome && (
          <TabStripHomeButton
            isActive={isPdfHomeActive}
            tooltip={t('ai_home.home')}
            onClick={onHome}
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
            onEditingBlur={(tabId, value) => handleEditingBlur(tabId, value, onRenameTab)}
            onEditingKeyDown={(event, tabId, value) =>
              handleEditingKeyDown(event, tabId, value, onRenameTab)
            }
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
