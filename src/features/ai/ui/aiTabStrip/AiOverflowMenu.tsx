import type { Tab } from '@app/providers/AiContext'
import { ToolbarButton } from '@shared/ui/components/primitives'
import { getAiIcon } from '@ui/components/Icons'

import { MoreHorizontal, X } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'

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
  if (overflowTabs.length === 0) {
    return null
  }

  return (
    <div ref={overflowRef} className="relative ml-auto shrink-0">
      <ToolbarButton
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
          transition={{ duration: 0.12 }}
          className="z-dropdown border-border bg-popover text-popover-foreground shadow-ambient-lg absolute top-10 right-0 max-h-56 w-[260px] overflow-y-auto rounded-lg border p-1 backdrop-blur-md"
        >
          {overflowTabs.map((tab) => {
            const label = getTabLabel(tab)
            return (
              <button
                key={tab.id}
                type="button"
                className="text-popover-foreground hover:bg-muted focus-visible:ring-ring/40 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => onSelectTab(tab.id)}
                onContextMenu={(event) => onContextMenu(event, tab.id)}
                title={label}
                aria-label={label}
              >
                <span className="text-muted-foreground shrink-0">
                  {getAiIcon(getIconKey(tab)) || (
                    <span className="text-ql-10 font-bold uppercase">{label.charAt(0)}</span>
                  )}
                </span>
                <span className="text-ql-12 text-foreground min-w-0 flex-1 truncate">{label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={tr('tab_close', 'Close tab')}
                  className="border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md border p-1 transition-colors"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onCloseTab(tab.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      onCloseTab(tab.id)
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default memo(AiOverflowMenu)
