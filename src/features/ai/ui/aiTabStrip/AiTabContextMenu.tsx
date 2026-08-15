import type { Tab } from '@app/providers/AiContext'

import { motion } from 'motion/react'
import { memo, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import type { ContextMenuState } from './types'

interface AiTabContextMenuProps {
  contextMenu: ContextMenuState | null
  contextMenuTab?: Tab
  tabsCount: number
  contextMenuRef: RefObject<HTMLDivElement | null>
  tr: (key: string, fallback: string) => string
  onBeginRename: (tabId: string) => void
  onTogglePin: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onDismiss: () => void
}

function AiTabContextMenu({
  contextMenu,
  contextMenuTab,
  tabsCount,
  contextMenuRef,
  tr,
  onBeginRename,
  onTogglePin,
  onCloseTab,
  onDismiss
}: AiTabContextMenuProps) {
  if (!contextMenu || !contextMenuTab) {
    return null
  }

  return createPortal(
    <motion.div
      ref={contextMenuRef}
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="border-border bg-popover text-popover-foreground shadow-ambient-lg fixed z-[1200] min-w-[160px] rounded-lg border p-1 backdrop-blur-md"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        type="button"
        className="text-ql-12 text-popover-foreground hover:bg-muted focus-visible:ring-ring/40 w-full rounded-md px-2.5 py-1.5 text-left font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => onBeginRename(contextMenuTab.id)}
      >
        {tr('tab_rename', 'Rename')}
      </button>
      <button
        type="button"
        className="text-ql-12 text-popover-foreground hover:bg-muted focus-visible:ring-ring/40 w-full rounded-md px-2.5 py-1.5 text-left font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => {
          onTogglePin(contextMenuTab.id)
          onDismiss()
        }}
      >
        {contextMenuTab.pinned ? tr('tab_unpin', 'Unpin') : tr('tab_pin', 'Pin')}
      </button>
      <button
        type="button"
        className="text-ql-12 text-popover-foreground hover:bg-muted focus-visible:ring-ring/40 w-full rounded-md px-2.5 py-1.5 text-left font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        disabled={tabsCount <= 1}
        onClick={() => {
          onCloseTab(contextMenuTab.id)
          onDismiss()
        }}
      >
        {tr('tab_close', 'Close')}
      </button>
    </motion.div>,
    document.body
  )
}

export default memo(AiTabContextMenu)
