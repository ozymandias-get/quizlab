import { MenuItem, MenuSurface } from '@app/components/ui/menu'
import type { Tab } from '@app/providers/AiContext'
import { DURATION } from '@shared/lib/motion'

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
      transition={{ duration: DURATION.normal }}
      className="z-dropdown fixed"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <MenuSurface className="min-w-[160px]">
        <MenuItem onClick={() => onBeginRename(contextMenuTab.id)}>
          {tr('tab_rename', 'Rename')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onTogglePin(contextMenuTab.id)
            onDismiss()
          }}
        >
          {contextMenuTab.pinned ? tr('tab_unpin', 'Unpin') : tr('tab_pin', 'Pin')}
        </MenuItem>
        <MenuItem
          disabled={tabsCount <= 1}
          onClick={() => {
            onCloseTab(contextMenuTab.id)
            onDismiss()
          }}
        >
          {tr('tab_close', 'Close')}
        </MenuItem>
      </MenuSurface>
    </motion.div>,
    document.body
  )
}

export default memo(AiTabContextMenu)
