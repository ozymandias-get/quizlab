import type { AiPlatform } from '@shared-core/types'

import type { Tab } from '@app/providers/AiContext'
import { isValidHexColor } from '@shared/lib/uiUtils'

import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { clamp, getVisibleTabIds } from './aiTabStripUtils'
import type { ContextMenuState } from './types'

interface UseAiTabStripStateParams {
  tabs: Tab[]
  activeTabId: string
  aiSites: Record<string, AiPlatform>
  t: (key: string) => string
  renameTab: (tabId: string, title?: string) => void
}

export function useAiTabStripState({
  tabs,
  activeTabId,
  aiSites,
  t,
  renameTab
}: UseAiTabStripStateParams) {
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const skipBlurSaveRef = useRef(false)

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isOverflowOpen, setIsOverflowOpen] = useState(false)

  // Refs to keep callback deps stable — prevents the returned `helpers`/
  // `actions` objects from being re-created on every `tabs`/`aiSites`/`t`
  // change, which would break memo on every AiVisibleTabButton child.
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const aiSitesRef = useRef(aiSites)
  aiSitesRef.current = aiSites
  const tRef = useRef(t)
  tRef.current = t

  const visibleTabIds = useMemo(() => getVisibleTabIds(tabs, activeTabId), [tabs, activeTabId])
  const { visibleTabs, overflowTabs } = useMemo(() => {
    const nextVisibleTabs: Tab[] = []
    const nextOverflowTabs: Tab[] = []

    for (const tab of tabs) {
      if (visibleTabIds.has(tab.id)) {
        nextVisibleTabs.push(tab)
        continue
      }

      nextOverflowTabs.push(tab)
    }

    return {
      visibleTabs: nextVisibleTabs,
      overflowTabs: nextOverflowTabs
    }
  }, [tabs, visibleTabIds])

  const tr = useCallback(
    (key: string, fallback: string) => {
      const translated = tRef.current(key)
      return translated === key ? fallback : translated
    },
    [] // stable — reads latest `t` from ref
  )

  const getTabLabel = useCallback(
    (tab: Tab) => {
      const currentAiSites = aiSitesRef.current
      const currentT = tRef.current
      if (tab.title) return tab.title
      const site = currentAiSites[tab.modelId]
      const translated = currentT(tab.modelId)
      if (translated && translated !== tab.modelId) return translated
      return site?.displayName || site?.name || tab.modelId
    },
    [] // stable — reads latest aiSites/t from refs
  )

  const getTabColor = useCallback(
    (tab: Tab) => {
      const color = aiSitesRef.current[tab.modelId]?.color
      return color && isValidHexColor(color) ? color : '#ffffff'
    },
    [] // stable — reads latest aiSites from ref
  )

  const handleOpenContextMenu = useCallback((event: ReactMouseEvent, tabId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setIsOverflowOpen(false)
    setEditingTabId(null)

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    setContextMenu({
      tabId,
      x: clamp(event.clientX, 12, Math.max(12, viewportWidth - 188)),
      y: clamp(event.clientY, 12, Math.max(12, viewportHeight - 126))
    })
  }, [])

  const beginRename = useCallback(
    (tabId: string) => {
      setContextMenu(null)
      setIsOverflowOpen(false)
      const tab = tabsRef.current.find((t) => t.id === tabId)
      setEditingTabId(tabId)
      setEditingValue(tab?.title || '')
    },
    [] // stable — reads latest `tabs` from ref
  )

  // renameTab is stable (useCallback with setPinnedTabs dep) but keep
  // a ref to be safe — avoids entire `actions` object recreation if the
  // parent ever changes renameTab's deps.
  const renameTabRef = useRef(renameTab)
  renameTabRef.current = renameTab

  const commitRename = useCallback(
    (tabId: string, value: string) => {
      renameTabRef.current(tabId, value)
      setEditingTabId(null)
      setEditingValue('')
    },
    [] // stable — reads latest `renameTab` from ref
  )

  const cancelRename = useCallback(() => {
    skipBlurSaveRef.current = true
    setEditingTabId(null)
    setEditingValue('')
  }, [])

  useEffect(() => {
    if (editingTabId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [editingTabId])

  useEffect(() => {
    // Only attach the document listener when a menu is actually open.
    // Previously this ran unconditionally, adding/removing a document
    // mousedown listener on every state toggle and wasting cycles when
    // neither the context menu nor overflow panel was visible.
    if (!contextMenu && !isOverflowOpen) return

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

  useEffect(() => {
    if (editingTabId && !tabs.some((tab) => tab.id === editingTabId)) {
      setEditingTabId(null)
      setEditingValue('')
    }
  }, [editingTabId, tabs])

  const contextMenuTab = tabs.find((tab) => tab.id === contextMenu?.tabId)

  // All callbacks below are now stable (useCallback([]) thanks to refs),
  // and useState setters are inherently stable. Memoize once to prevent
  // parent re-renders from creating new `helpers`/`actions` object
  // references, which would break memo on AiVisibleTabButton et al.
  const helpers = useMemo(() => ({ tr, getTabLabel, getTabColor }), [tr, getTabLabel, getTabColor])
  const actions = useMemo(
    () => ({
      setEditingValue,
      setContextMenu,
      setIsOverflowOpen,
      beginRename,
      commitRename,
      cancelRename,
      handleOpenContextMenu
    }),
    [
      setEditingValue,
      setContextMenu,
      setIsOverflowOpen,
      beginRename,
      commitRename,
      cancelRename,
      handleOpenContextMenu
    ]
  )

  return {
    refs: {
      contextMenuRef,
      overflowRef,
      renameInputRef,
      skipBlurSaveRef
    },
    state: {
      editingTabId,
      editingValue,
      contextMenu,
      contextMenuTab,
      isOverflowOpen,
      visibleTabs,
      overflowTabs
    },
    helpers,
    actions
  }
}
