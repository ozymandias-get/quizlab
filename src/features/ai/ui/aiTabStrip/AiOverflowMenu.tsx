import { MenuSurface } from '@app/components/ui/menu'
import type { Tab } from '@app/providers/ai-context'
import { DURATION } from '@shared/lib/motion'
import {
  IconButton,
  ToolbarButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'
import { getAiIcon } from '@ui/components/Icons'

import { MoreHorizontal, X } from 'lucide-react'
import { motion } from 'motion/react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'

interface AiOverflowMenuProps {
  overflowTabs: Tab[]
  overflowRef: RefObject<HTMLDivElement | null>
  isOverflowOpen: boolean
  tr: (key: string, fallback: string) => string
  getTabLabel: (tab: Tab) => string
  getIconKey: (tab: Tab) => string
  onToggleOpen: () => void
  onSelectTab: (tabId: string) => void
  onContextMenu: (event: ReactMouseEvent, tabId: string) => void
  onCloseTab: (tabId: string) => void
}

function AiOverflowMenu({
  overflowTabs,
  overflowRef,
  isOverflowOpen,
  tr,
  getTabLabel,
  getIconKey,
  onToggleOpen,
  onSelectTab,
  onContextMenu,
  onCloseTab
}: AiOverflowMenuProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const [menuPlacement, setMenuPlacement] = useState<'top' | 'bottom'>('bottom')
  const [menuMaxHeight, setMenuMaxHeight] = useState(224)

  useEffect(() => {
    if (!isOverflowOpen) return
    surfaceRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
  }, [isOverflowOpen])

  // Keep the panel inside the visible band: prefer below, flip above when the
  // trigger sits near the bottom, and cap the height to the chosen side.
  useLayoutEffect(() => {
    if (!isOverflowOpen) return
    const trigger = triggerRef.current
    const menu = surfaceRef.current
    if (!trigger || !menu || window.innerHeight <= 0) return

    const rect = trigger.getBoundingClientRect()
    const margin = 8
    const desired = Math.min(menu.scrollHeight || 224, 224)
    const spaceBelow = window.innerHeight - rect.bottom - margin
    const spaceAbove = rect.top - margin
    const openUp = spaceBelow < desired && spaceAbove > spaceBelow

    setMenuPlacement(openUp ? 'top' : 'bottom')
    setMenuMaxHeight(Math.max(96, Math.min(224, openUp ? spaceAbove : spaceBelow)))
  }, [isOverflowOpen])

  useEffect(() => {
    if (isOverflowOpen) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    const active = document.activeElement
    if (!active || active === document.body || !active.isConnected) {
      triggerRef.current?.focus()
    }
  }, [isOverflowOpen])

  if (overflowTabs.length === 0) {
    return null
  }

  return (
    <div ref={overflowRef} className="relative ml-auto shrink-0">
      <ToolbarButton
        ref={triggerRef}
        icon={MoreHorizontal}
        className="!w-auto min-w-[32px] px-1.5"
        tooltip={tr('tab_more', 'More tabs')}
        tooltipSide="top"
        tooltipAvoidCollisions={false}
        isActive={isOverflowOpen}
        onClick={onToggleOpen}
      />

      {isOverflowOpen && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: DURATION.normal }}
          className={`z-dropdown absolute right-0 ${
            menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <MenuSurface
            ref={surfaceRef}
            role="dialog"
            aria-label={tr('tab_more', 'More tabs')}
            className="w-[min(260px,calc(100vw-16px))] overflow-y-auto"
            style={{ maxHeight: menuMaxHeight }}
          >
            {overflowTabs.map((tab) => {
              const label = getTabLabel(tab)
              return (
                <div
                  key={tab.id}
                  role="group"
                  aria-label={label}
                  className="group hover:bg-muted flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors"
                  onContextMenu={(event) => onContextMenu(event, tab.id)}
                >
                  <button
                    type="button"
                    className="text-popover-foreground focus-visible:ring-ring/70 flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    onClick={() => onSelectTab(tab.id)}
                    aria-label={label}
                  >
                    <span className="text-muted-foreground shrink-0">
                      {getAiIcon(getIconKey(tab)) || (
                        <span className="text-ql-10 font-bold uppercase">{label.charAt(0)}</span>
                      )}
                    </span>
                    <span className="text-ql-12 text-foreground min-w-0 flex-1 truncate">
                      {label}
                    </span>
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <IconButton
                        type="button"
                        size="compact"
                        variant="ghost"
                        aria-label={tr('tab_close', 'Close tab')}
                        className="text-muted-foreground hover:text-foreground transition-opacity"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          onCloseTab(tab.id)
                          onToggleOpen()
                        }}
                      >
                        <X className="h-3 w-3" />
                      </IconButton>
                    </TooltipTrigger>
                    <TooltipContent side="top" avoidCollisions={false}>
                      {tr('tab_close', 'Close tab')}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )
            })}
          </MenuSurface>
        </motion.div>
      )}
    </div>
  )
}

export default memo(AiOverflowMenu)
