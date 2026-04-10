import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { motion } from 'framer-motion'
import { MoreHorizontal, X } from 'lucide-react'
import type { Tab } from '@app/providers/AiContext'
import { getAiIcon } from '@ui/components/Icons'
import { ToolbarButton } from '@shared/ui/components/primitives'

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
          className="absolute right-0 top-10 z-40 w-[260px] max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-[#080808]/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-1.5"
        >
          {overflowTabs.map((tab) => {
            const label = getTabLabel(tab)
            return (
              <button
                key={tab.id}
                type="button"
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10 transition-colors text-left"
                onClick={() => onSelectTab(tab.id)}
                onContextMenu={(event) => onContextMenu(event, tab.id)}
                title={label}
              >
                <span className="text-white/85 shrink-0">
                  {getAiIcon(getIconKey(tab)) || (
                    <span className="text-ql-10 font-bold uppercase">{label.charAt(0)}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-ql-12 text-white/85">{label}</span>
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
  )
}

export default AiOverflowMenu
