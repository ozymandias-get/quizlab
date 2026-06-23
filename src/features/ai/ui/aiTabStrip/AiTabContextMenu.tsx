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
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.16 }}
      className="fixed z-[1200] min-w-[170px] rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 shadow-xl shadow-black/60 backdrop-blur-lg"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        type="button"
        className="text-ql-12 w-full rounded-lg px-3 py-2 text-left text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        onClick={() => onBeginRename(contextMenuTab.id)}
      >
        {tr('tab_rename', 'Rename')}
      </button>
      <button
        type="button"
        className="text-ql-12 w-full rounded-lg px-3 py-2 text-left text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        onClick={() => {
          onTogglePin(contextMenuTab.id)
          onDismiss()
        }}
      >
        {contextMenuTab.pinned ? tr('tab_unpin', 'Unpin') : tr('tab_pin', 'Pin')}
      </button>
      <button
        type="button"
        className="text-ql-12 w-full rounded-lg px-3 py-2 text-left text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
