import type { PdfTab } from '@features/pdf/hooks/types'

import { MenuItem, MenuSurface } from '@app/components/ui/menu'
import { useMenuKeyboardNavigation } from '@app/components/ui/useMenuKeyboardNavigation'
import { DURATION } from '@shared/lib/motion'

import { motion } from 'motion/react'
import { memo, useRef } from 'react'
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
  const menuRef = useRef<HTMLDivElement>(null)
  const setMenuRef = useMenuKeyboardNavigation(menuRef, { onClose: onDismiss })

  if (!contextMenu || !tab) return null

  return createPortal(
    <motion.div
      ref={setMenuRef}
      id="tab-context-menu"
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: DURATION.normal }}
      className="z-dropdown fixed"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <MenuSurface className="min-w-[160px]">
        <MenuItem
          onClick={() => {
            onBeginRename(tab)
            onDismiss()
          }}
        >
          {tr('tab_rename', 'Rename')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            onCloseTab(tab.id)
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

export default memo(TabContextMenu)
