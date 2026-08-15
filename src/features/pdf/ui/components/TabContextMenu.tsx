import type { PdfTab } from '@features/pdf/hooks/types'

import { motion } from 'motion/react'
import { memo } from 'react'
import { createPortal } from 'react-dom'

interface TabContextMenuProps {
  contextMenu: { tabId: string; x: number; y: number } | null
  tab: PdfTab | undefined
  tr: (key: string, fallback: string) => string
  onBeginRename: (tab: PdfTab) => void
  onCloseTab: (tabId: string) => void
  onDismiss: () => void
}

function TabContextMenu({
  contextMenu,
  tab,
  tr,
  onBeginRename,
  onCloseTab,
  onDismiss
}: TabContextMenuProps) {
  if (!contextMenu || !tab) return null

  return createPortal(
    <motion.div
      id="tab-context-menu"
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
        onClick={() => {
          onBeginRename(tab)
          onDismiss()
        }}
      >
        {tr('tab_rename', 'Rename')}
      </button>
      <button
        type="button"
        className="text-ql-12 text-popover-foreground hover:bg-muted focus-visible:ring-ring/40 w-full rounded-md px-2.5 py-1.5 text-left font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => {
          onCloseTab(tab.id)
          onDismiss()
        }}
      >
        {tr('tab_close', 'Close')}
      </button>
    </motion.div>,
    document.body
  )
}

export default memo(TabContextMenu)
