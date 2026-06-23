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
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.16 }}
      className="glass-tier-2 fixed z-[1200] min-w-[170px] rounded-xl border-white/[0.12] p-1.5"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        type="button"
        className="text-ql-12 w-full rounded-lg px-3 py-2 text-left text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        onClick={() => {
          onBeginRename(tab)
          onDismiss()
        }}
      >
        {tr('tab_rename', 'Rename')}
      </button>
      <button
        type="button"
        className="text-ql-12 w-full rounded-lg px-3 py-2 text-left text-white/85 transition-colors hover:bg-white/10 hover:text-white"
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
