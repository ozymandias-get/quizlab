import type { PdfTab } from '@features/pdf/hooks/types'

import { MenuItem, MenuSurface } from '@app/components/ui/menu'
import { useMenuKeyboardNavigation } from '@app/components/ui/useMenuKeyboardNavigation'
import { fitMenuToViewport } from '@shared/lib/menuPosition'
import { DURATION } from '@shared/lib/motion'

import { motion } from 'motion/react'
import { memo, type RefObject, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface TabContextMenuProps {
  contextMenu: { tabId: string; x: number; y: number } | null
  tab: PdfTab | undefined
  tr: (key: string, fallback: string) => string
  onCloseTab: (tabId: string) => void
  onDismiss: () => void
  triggerRef?: RefObject<HTMLElement | null>
}

function TabContextMenu({
  contextMenu,
  tab,
  tr,
  onCloseTab,
  onDismiss,
  triggerRef
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const setMenuRef = useMenuKeyboardNavigation(menuRef, { onClose: onDismiss, triggerRef })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!contextMenu || !el) return
    const rect = el.getBoundingClientRect()
    const { left, top } = fitMenuToViewport(contextMenu.x, contextMenu.y, rect.width, rect.height)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [contextMenu])

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
