import type { AiPlatform } from '@shared-core/types'

import type { Tab } from '@app/providers/ai-context'
import { isValidHexColor } from '@shared/lib/uiUtils'

import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  AI_TAB_MIN_WIDTH,
  getAiTabStripChromeWidth,
  getDesiredAiTabWidth,
  getInitialVisibleAiTabs,
  getVisibleTabIds,
  resolveVisibleAiTabCount
} from './aiTabStripUtils'
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
  const contextMenuTriggerRef = useRef<HTMLElement | null>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const skipBlurSaveRef = useRef(false)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isOverflowOpen, setIsOverflowOpen] = useState(false)
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(3)

  // A tab close, open or rename changes how much room the pills need. Reset to
  // the width-based estimate first; the measurement pass below trims it again
  // if the new labels are still too wide. Without this reset the capacity could
  // only ever shrink within one row width.
  // Include every input that can change a pill's rendered label width: the
  // title, the model/site label used when there is no title, and its
  // translation. Colour and pin state do not affect width.
  const tabContentSignature = tabs
    .map((tab) => {
      const site = aiSites[tab.modelId]
      return [
        tab.id,
        tab.title ?? '',
        tab.modelId,
        site?.displayName ?? '',
        site?.name ?? '',
        t(tab.modelId)
      ].join(':')
    })
    .join('|')
  // Prevent an add/remove loop when a returning tab turns out wider than the
  // measured pills used to predict it.
  const blockedCapacityRef = useRef<number | null>(null)

  const getInitialCapacity = useCallback((width: number) => {
    blockedCapacityRef.current = null
    // Home + refresh + divider are always rendered before the pills. The
    // overflow button is only reserved when a tab really has to be hidden.
    return getInitialVisibleAiTabs(width, tabsRef.current.length, {
      hasHome: true,
      hasRefresh: true
    })
  }, [])

  const lastTabContentSignatureRef = useRef(tabContentSignature)
  useLayoutEffect(() => {
    if (lastTabContentSignatureRef.current === tabContentSignature) return
    lastTabContentSignatureRef.current = tabContentSignature

    const width = rowRef.current?.clientWidth ?? 0
    if (width > 0) setMaxVisibleTabs(getInitialCapacity(width))
  }, [getInitialCapacity, tabContentSignature])

  useEffect(() => {
    const el = rowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const width =
        entries[0]?.contentBoxSize?.[0]?.inlineSize ?? entries[0]?.contentRect?.width ?? 0
      if (width > 0) setMaxVisibleTabs(getInitialCapacity(width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [getInitialCapacity])

  // Refs to keep callback deps stable — prevents the returned `helpers`/
  // `actions` objects from being re-created on every `tabs`/`aiSites`/`t`
  // change, which would break memo on every AiVisibleTabButton child.
  const aiSitesRef = useRef(aiSites)
  aiSitesRef.current = aiSites
  const tRef = useRef(t)
  tRef.current = t

  // `getMaxVisibleAiTabs` assumes the smallest pill. Long labels are wider, so
  // after layout we measure how much the rendered pills actually need and lower
  // the capacity until they fit. `scrollWidth` on the truncated label recovers
  // the text that would otherwise be clipped.
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row || row.clientWidth <= 0) return

    const renderedTabs = [...row.querySelectorAll<HTMLElement>('[data-ai-tab]')]
    // A positive capacity should always have rendered pills; an empty list at
    // zero is expected and is how the capacity can climb back from zero.
    if (renderedTabs.length === 0 && maxVisibleTabs > 0) return

    // `clientWidth` includes the row's horizontal padding; the ResizeObserver
    // path measures the content box, so remove the padding here too.
    const style = window.getComputedStyle(row)
    const contentWidth =
      row.clientWidth -
      (Number.parseFloat(style.paddingLeft) || 0) -
      (Number.parseFloat(style.paddingRight) || 0)
    const available =
      contentWidth -
      getAiTabStripChromeWidth({
        hasHome: true,
        hasRefresh: true,
        hasOverflow: tabs.length > renderedTabs.length
      })
    const tabWidths = renderedTabs.map((tab) => {
      const label = tab.querySelector<HTMLElement>('[data-ai-tab-label]')
      const clippedText = label ? Math.max(0, label.scrollWidth - label.clientWidth) : 0
      return getDesiredAiTabWidth(tab.offsetWidth, clippedText)
    })

    let next = resolveVisibleAiTabCount({
      current: maxVisibleTabs,
      tabWidths,
      availableWidth: available,
      hasOverflow: tabs.length > renderedTabs.length,
      incrementReserveWidth: tabWidths.length > 0 ? Math.max(...tabWidths) : AI_TAB_MIN_WIDTH
    })

    if (next > maxVisibleTabs && blockedCapacityRef.current === next) {
      next = maxVisibleTabs
    }

    if (next < maxVisibleTabs) blockedCapacityRef.current = maxVisibleTabs
    else if (next > maxVisibleTabs) blockedCapacityRef.current = null

    if (next !== maxVisibleTabs) setMaxVisibleTabs(next)
  }, [maxVisibleTabs, tabs, activeTabId])

  const visibleTabIds = useMemo(
    () => getVisibleTabIds(tabs, activeTabId, maxVisibleTabs),
    [tabs, activeTabId, maxVisibleTabs]
  )
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

    contextMenuTriggerRef.current =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null

    // Store the raw pointer position; the menu measures itself and clamps to
    // the viewport, so translated or scaled menus cannot overflow.
    setContextMenu({
      tabId,
      x: event.clientX,
      y: event.clientY
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
    (tabId: string, tabTitle: string) => {
      renameTabRef.current(tabId, tabTitle)
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Prevent Escape from also collapsing the composer, which listens
      // on document and bails out when the event is defaultPrevented.
      event.preventDefault()
      setContextMenu(null)
      setIsOverflowOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
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
      contextMenuTriggerRef,
      overflowRef,
      rowRef,
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
