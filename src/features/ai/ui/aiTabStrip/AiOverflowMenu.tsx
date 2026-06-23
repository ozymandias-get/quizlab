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
        className="!w-auto min-w-[36px] px-1.5 text-white/75 hover:bg-white/[0.08] hover:text-white"
        tooltip={tr('tab_more', 'More tabs')}
        isActive={isOverflowOpen}
        onClick={onToggleOpen}
      />

      {isOverflowOpen && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className="z-dropdown absolute top-10 right-0 max-h-56 w-[260px] overflow-y-auto rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-xl shadow-black/60 backdrop-blur-lg"
        >
          {overflowTabs.map((tab) => {
            const label = getTabLabel(tab)
            return (
              <button
                key={tab.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/10"
                onClick={() => onSelectTab(tab.id)}
                onContextMenu={(event) => onContextMenu(event, tab.id)}
                title={label}
                aria-label={label}
              >
                <span className="shrink-0 text-white/85">
                  {getAiIcon(getIconKey(tab)) || (
                    <span className="text-ql-10 font-bold uppercase">{label.charAt(0)}</span>
                  )}
                </span>
                <span className="text-ql-12 min-w-0 flex-1 truncate text-white/85">{label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={tr('tab_close', 'Close tab')}
                  className="shrink-0 rounded-md border border-white/15 bg-black/35 p-1 text-white/60 transition-colors hover:text-white"
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
