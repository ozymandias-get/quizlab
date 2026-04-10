import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { FileText, MoreHorizontal, Plus, X } from 'lucide-react'
import { useLanguageStrings } from '@app/providers/LanguageContext'
import type { PdfTab } from '@features/pdf/hooks/usePdfSelection'
import { getAiIcon } from '@ui/components/Icons'
import { TAB_STRIP_BAR_CLASS, TAB_STRIP_ROW_CLASS } from '@shared/ui/tabStripChrome'
import { TabStripHomeButton, ToolbarButton } from '@shared/ui/components/primitives'

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

const getVisibleTabIds = (tabs: PdfTab[] = [], activeTabId: string): Set<string> => {
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
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const skipBlurSaveRef = useRef(false)

  const [isOverflowOpen, setIsOverflowOpen] = useState(false)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
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

    return {
      visibleTabs: nextVisibleTabs,
      overflowTabs: nextOverflowTabs
    }
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
    (tab: PdfTab) => {
      return tab.title || tab.file?.name || tr('new_tab_title', 'New Tab')
    },
    [tr]
  )

  const getTabIcon = useCallback((tab: PdfTab) => {
    if (tab.kind === 'drive') {
      return getAiIcon('gdrive') || <FileText className="w-3.5 h-3.5 shrink-0 text-white/85" />
    }
    return <FileText className="w-3.5 h-3.5 shrink-0 text-white/85" />
  }, [])

  const beginRename = useCallback((tab: PdfTab) => {
    setContextMenu(null)
    setEditingTabId(tab.id)
    setEditingValue(tab.title || '')
  }, [])

  const commitRename = useCallback(
    (tabId: string, title: string) => {
      onRenameTab(tabId, title)
      setEditingTabId(null)
      setEditingValue('')
    },
    [onRenameTab]
  )

  const cancelRename = useCallback(() => {
    skipBlurSaveRef.current = true
    setEditingTabId(null)
    setEditingValue('')
  }, [])

  const handleOpenContextMenu = useCallback((event: ReactMouseEvent, tabId: string) => {
    event.preventDefault()
    event.stopPropagation()

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    setIsOverflowOpen(false)
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
      setEditingTabId(null)
      setEditingValue('')
    }
  }, [editingTabId, tabs])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenu(null)
      }
      if (isOverflowOpen && overflowRef.current && !overflowRef.current.contains(target)) {
        setIsOverflowOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [contextMenu, isOverflowOpen])

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
        {visibleTabs.map((tab) => {
          const label = getTabLabel(tab)
          const isActive = tab.id === activeTabId
          const isEditing = editingTabId === tab.id

          return (
            <motion.button
              key={tab.id}
              type="button"
              layout
              whileHover={{
                y: -0.5,
                scale: 1.005,
                transition: { type: 'spring', stiffness: 380, damping: 24 }
              }}
              whileTap={{ scale: 0.99 }}
              className="glass-tier-3 glass-tier-control glass-interactive group relative flex h-8 min-w-0 max-w-[250px] items-center gap-2 rounded-full border px-3.5 pr-10 transition-all duration-200"
              style={
                isActive
                  ? {
                      borderColor: 'rgba(16,185,129,0.44)',
                      background:
                        'linear-gradient(145deg, rgba(16,185,129,0.13), rgba(255,255,255,0.045))',
                      boxShadow:
                        '0 0 18px -8px rgba(16,185,129,0.38), inset 0 1px 0 rgba(255,255,255,0.1)'
                    }
                  : {
                      borderColor: 'rgba(255,255,255,0.08)',
                      background:
                        'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
                    }
              }
              onClick={() => onSetActiveTab(tab.id)}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                beginRename(tab)
              }}
              onContextMenu={(event) => handleOpenContextMenu(event, tab.id)}
              title={label}
            >
              <span className="flex items-center [&>svg]:w-3.5 [&>svg]:h-3.5 shrink-0 text-white/85">
                {getTabIcon(tab)}
              </span>

              {isEditing ? (
                <input
                  ref={renameInputRef}
                  value={editingValue}
                  onChange={(event) => setEditingValue(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    if (skipBlurSaveRef.current) {
                      skipBlurSaveRef.current = false
                      return
                    }
                    commitRename(tab.id, event.currentTarget.value)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitRename(tab.id, editingValue)
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelRename()
                    }
                  }}
                  placeholder={tr('tab_rename_placeholder', 'Tab name...')}
                  className="min-w-0 w-full bg-transparent text-ql-12 text-white outline-none placeholder:text-white/45"
                />
              ) : (
                <span className="min-w-0 truncate text-ql-12 text-white/85">{label}</span>
              )}

              <span
                role="button"
                tabIndex={-1}
                aria-label={tr('tab_close', 'Close')}
                title={tr('tab_close', 'Close')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md border border-white/15 bg-black/35 p-1 text-white/65 opacity-[0.55] transition-opacity hover:opacity-100 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onCloseTab(tab.id)
                }}
              >
                <X className="w-3 h-3" />
              </span>
            </motion.button>
          )
        })}

        {(overflowTabs || []).length > 0 && (
          <div ref={overflowRef} className="relative ml-auto shrink-0">
            <ToolbarButton
              icon={MoreHorizontal}
              className="!w-auto min-w-[36px] px-1.5 text-white/75 hover:bg-white/[0.08] hover:text-white"
              tooltip={tr('tab_more', 'More tabs')}
              isActive={isOverflowOpen}
              onClick={() => setIsOverflowOpen((prev) => !prev)}
            />

            {isOverflowOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="glass-tier-2 absolute right-0 top-10 z-40 w-[250px] max-h-56 overflow-y-auto rounded-xl border-white/[0.12] p-1.5"
              >
                {overflowTabs.map((tab) => {
                  const label = getTabLabel(tab)
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10 transition-colors text-left"
                      onClick={() => {
                        onSetActiveTab(tab.id)
                        setIsOverflowOpen(false)
                      }}
                      onContextMenu={(event) => handleOpenContextMenu(event, tab.id)}
                      title={label}
                    >
                      <span className="flex items-center [&>svg]:w-3.5 [&>svg]:h-3.5 shrink-0 text-white/85">
                        {getTabIcon(tab)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ql-12 text-white/85">
                        {label}
                      </span>
                      <span
                        role="button"
                        tabIndex={-1}
                        className="shrink-0 rounded-md border border-white/15 bg-black/35 p-1 text-white/60 hover:text-white transition-colors"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          onCloseTab(tab.id)
                        }}
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  )
                })}
              </motion.div>
            )}
          </div>
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

      {contextMenu &&
        contextMenuTab &&
        createPortal(
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="glass-tier-2 fixed z-[1200] min-w-[170px] rounded-xl border-white/[0.12] p-1.5"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-ql-12 text-white/85 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              onClick={() => beginRename(contextMenuTab)}
            >
              {tr('tab_rename', 'Rename')}
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-ql-12 text-white/85 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              onClick={() => {
                onCloseTab(contextMenuTab.id)
                setContextMenu(null)
              }}
            >
              {tr('tab_close', 'Close')}
            </button>
          </motion.div>,
          document.body
        )}
    </div>
  )
}

export default memo(PdfTabStrip)
