import type { AiPlatform } from '@shared-core/types'

import type { Tab } from '@app/providers/ai-context'

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
  /** The pin button occupies chrome width before the first pill. */
  hasPin?: boolean
}

export function useAiTabStripState({
  tabs,
  activeTabId,
  aiSites,
  t,
  hasPin = false
}: UseAiTabStripStateParams) {
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const contextMenuTriggerRef = useRef<HTMLElement | null>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [isOverflowOpen, setIsOverflowOpen] = useState(false)
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(3)

  // A tab close, open or reorder changes how much room the pills need. Reset to
  // the width-based estimate first; the measurement pass below trims it again
  // if the new labels are still too wide. Without this reset the capacity could
  // only ever shrink within one row width.
  // Include every input that can change a pill's rendered label width: the
  // model/site label and its translation.
  const tabContentSignature = tabs
    .map((tab) => {
      const site = aiSites[tab.modelId]
      return [tab.id, tab.modelId, site?.displayName ?? '', site?.name ?? '', t(tab.modelId)].join(
        ':'
      )
    })
    .join('|')
  // Prevent an add/remove loop when a returning tab turns out wider than the
  // measured pills used to predict it.
  const blockedCapacityRef = useRef<number | null>(null)

  const getInitialCapacity = useCallback(
    (width: number) => {
      blockedCapacityRef.current = null
      // Home + refresh + pin + divider are always rendered before the pills. The
      // overflow button is only reserved when a tab really has to be hidden.
      return getInitialVisibleAiTabs(width, tabsRef.current.length, {
        hasHome: true,
        hasRefresh: true,
        hasPin
      })
    },
    [hasPin]
  )

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
        hasPin,
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
  }, [hasPin, maxVisibleTabs, tabs, activeTabId])

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

  // An overflow menu that loses its last tab (closed, or the panel grew enough
  // to show every pill) must not stay latched open for the next overflow run.
  const hadOverflowRef = useRef(false)
  useEffect(() => {
    const hadOverflow = hadOverflowRef.current
    hadOverflowRef.current = overflowTabs.length > 0
    if (overflowTabs.length > 0) return

    if (isOverflowOpen) setIsOverflowOpen(false)
    if (!hadOverflow) return

    const active = document.activeElement
    if (!active || active === document.body || !active.isConnected) {
      rowRef.current?.querySelector<HTMLElement>('[data-ai-tab][aria-selected="true"]')?.focus()
    }
  }, [isOverflowOpen, overflowTabs.length])

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
      const site = currentAiSites[tab.modelId]
      const translated = currentT(tab.modelId)
      if (translated && translated !== tab.modelId) return translated
      return site?.displayName || site?.name || tab.modelId
    },
    [] // stable — reads latest aiSites/t from refs
  )

  const handleOpenContextMenu = useCallback((event: ReactMouseEvent, tabId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setIsOverflowOpen(false)

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

  useEffect(() => {
    // Only attach the document listener when a menu is actually open.
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

  const contextMenuTab = tabs.find((tab) => tab.id === contextMenu?.tabId)

  // All callbacks below are stable (useCallback([]) thanks to refs),
  // and useState setters are inherently stable. Memoize once to prevent
  // parent re-renders from creating new `helpers`/`actions` object
  // references, which would break memo on AiVisibleTabButton et al.
  const helpers = useMemo(() => ({ tr, getTabLabel }), [tr, getTabLabel])
  const actions = useMemo(
    () => ({
      setContextMenu,
      setIsOverflowOpen,
      handleOpenContextMenu
    }),
    [setContextMenu, setIsOverflowOpen, handleOpenContextMenu]
  )

  return {
    refs: {
      contextMenuRef,
      contextMenuTriggerRef,
      overflowRef,
      rowRef
    },
    state: {
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
