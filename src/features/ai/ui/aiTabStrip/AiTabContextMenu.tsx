import { MenuItem, MenuSurface } from '@app/components/ui/menu'
import { useMenuKeyboardNavigation } from '@app/components/ui/useMenuKeyboardNavigation'
import type { Tab } from '@app/providers/ai-context'
import { fitMenuElementToViewport } from '@shared/lib/menuPosition'
import { DURATION } from '@shared/lib/motion'

import { motion } from 'motion/react'
import { memo, type RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { ContextMenuState } from './types'

interface AiTabContextMenuProps {
  contextMenu: ContextMenuState | null
  contextMenuTab?: Tab
  tabsCount: number
  contextMenuRef: RefObject<HTMLDivElement | null>
  triggerRef?: RefObject<HTMLElement | null>
  tr: (key: string, fallback: string) => string
  onCloseTab: (tabId: string) => void
  onDismiss: () => void
}

function AiTabContextMenu({
  contextMenu,
  contextMenuTab,
  tabsCount,
  contextMenuRef,
  triggerRef,
  tr,
  onCloseTab,
  onDismiss
}: AiTabContextMenuProps) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const setContextMenuRef = useMenuKeyboardNavigation(contextMenuRef, {
    onClose: onDismiss,
    triggerRef
  })

  // Measure the real menu instead of assuming a fixed width/height, then keep
  // it inside the viewport. Translations and display scaling change its size.
  // The shared helper reads the layout box, so the entrance scale animation
  // cannot make the clamp use a temporarily smaller menu.
  const positionMenu = useCallback(() => {
    const el = contextMenuRef.current
    if (!contextMenu || !el) return
    setPosition(fitMenuElementToViewport(el, contextMenu.x, contextMenu.y))
  }, [contextMenu, contextMenuRef])

  useLayoutEffect(positionMenu, [positionMenu])

  // The menu stays open through a window resize; keep it inside the new
  // viewport instead of leaving it clipped off the edge.
  useEffect(() => {
    if (!contextMenu) return
    window.addEventListener('resize', positionMenu)
    return () => window.removeEventListener('resize', positionMenu)
  }, [contextMenu, positionMenu])

  if (!contextMenu || !contextMenuTab) {
    return null
  }

  return createPortal(
    <motion.div
      ref={setContextMenuRef}
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: DURATION.normal }}
      className="z-dropdown fixed"
      style={{
        left: position?.left ?? contextMenu.x,
        top: position?.top ?? contextMenu.y
      }}
    >
      <MenuSurface className="min-w-[160px]">
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
