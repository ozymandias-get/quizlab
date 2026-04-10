import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from 'react'
import type { AiPlatform } from '@shared-core/types'
import type { Tab } from '@app/providers/AiContext'
import { clamp, getVisibleTabIds, isValidColor } from './utils'
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

  const visibleTabIds = useMemo(() => getVisibleTabIds(tabs, activeTabId), [tabs, activeTabId])
  const { visibleTabs, overflowTabs } = useMemo(() => {
    const nextVisibleTabs: Tab[] = []
    const nextOverflowTabs: Tab[] = []

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

  const tr = useCallback(
    (key: string, fallback: string) => {
      const translated = t(key)
      return translated === key ? fallback : translated
    },
    [t]
  )

  const getTabLabel = useCallback(
    (tab: Tab) => {
      if (tab.title) return tab.title
      const site = aiSites[tab.modelId]
      const translated = t(tab.modelId)
      if (translated && translated !== tab.modelId) return translated
      return site?.displayName || site?.name || tab.modelId
    },
    [aiSites, t]
  )

  const getTabColor = useCallback(
    (tab: Tab) => {
      const color = aiSites[tab.modelId]?.color
      return color && isValidColor(color) ? color : '#ffffff'
    },
    [aiSites]
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

  const beginRename = useCallback((tab: Tab) => {
    setContextMenu(null)
    setIsOverflowOpen(false)
    setEditingTabId(tab.id)
    setEditingValue(tab.title || '')
  }, [])

  const commitRename = useCallback(
    (tabId: string, value: string) => {
      renameTab(tabId, value)
      setEditingTabId(null)
      setEditingValue('')
    },
    [renameTab]
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
    helpers: {
      tr,
      getTabLabel,
      getTabColor
    },
    actions: {
      setEditingValue,
      setContextMenu,
      setIsOverflowOpen,
      beginRename,
      commitRename,
      cancelRename,
      handleOpenContextMenu
    }
  }
}
