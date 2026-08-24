import { IconButton } from '@app/components/ui/icon-button'
import { MenuSurface } from '@app/components/ui/menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import type { Tab } from '@app/providers/ai-context'
import { DURATION } from '@shared/lib/motion'
import { ToolbarButton } from '@shared/ui/components/primitives'
import { getAiIcon } from '@ui/components/Icons'

import { MoreHorizontal, X } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, type MouseEvent as ReactMouseEvent, type RefObject, useEffect, useRef } from 'react'

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

  useEffect(() => {
    if (!isOverflowOpen) return
    surfaceRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus()
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
        isActive={isOverflowOpen}
        onClick={onToggleOpen}
      />

      {isOverflowOpen && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: DURATION.normal }}
          className="z-dropdown absolute top-10 right-0"
        >
          <MenuSurface
            ref={surfaceRef}
            role="dialog"
            aria-label={tr('tab_more', 'More tabs')}
            className="max-h-56 w-[260px] overflow-y-auto"
          >
            {overflowTabs.map((tab) => {
              const label = getTabLabel(tab)
              return (
                <div
                  key={tab.id}
                  role="group"
                  aria-label={label}
                  className="group hover:bg-muted flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors"
                  onContextMenu={(event) => onContextMenu(event, tab.id)}
                >
                  <button
                    type="button"
                    className="text-popover-foreground focus-visible:ring-ring/40 flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
                    <TooltipContent>{tr('tab_close', 'Close tab')}</TooltipContent>
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
