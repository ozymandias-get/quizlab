import { MenuItem, MenuSeparator, MenuSurface } from '@app/components/ui/menu'
import { useMenuKeyboardNavigation } from '@app/components/ui/useMenuKeyboardNavigation'
import { fitMenuToViewport } from '@shared/lib/menuPosition'
import { DURATION } from '@shared/lib/motion'

import type { LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  shortcut?: string
  danger?: boolean
  separator?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y })
  const [isReady, setIsReady] = useState(false)

  const setMenuRef = useMenuKeyboardNavigation(menuRef, { onClose })

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleScroll = () => onClose()
    const handleResize = () => onClose()

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    const preventDefault = (e: Event) => e.preventDefault()
    const menuNode = menuRef.current
    menuNode?.addEventListener('contextmenu', preventDefault)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      menuNode?.removeEventListener('contextmenu', preventDefault)
    }
  }, [onClose])

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      // One shared collision rule (12px margin) instead of a bespoke 10px
      // clamp: a menu never touches the window frame.
      const { left, top } = fitMenuToViewport(x, y, rect.width, rect.height)
      setAdjustedPosition({ x: left, y: top })
      setIsReady(true)
    }
  }, [x, y])

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={setMenuRef}
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={isReady ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: -5 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: DURATION.fast, ease: 'easeOut' }}
        className="z-dropdown fixed origin-top-left"
        style={{
          top: adjustedPosition.y,
          left: adjustedPosition.x,
          opacity: isReady ? undefined : 0
        }}
      >
        {/*
                  Visual styling wrapper separated from motion.div to prevent
                  framer-motion backdrop-blur animation artifacts.
                */}
        <MenuSurface className="min-w-[200px] overflow-hidden">
          {items.map((item, index) => {
            if (item.separator) {
              // eslint-disable-next-line react/no-array-index-key -- Static menu items, stable order
              return <MenuSeparator key={index} />
            }

            const Icon = item.icon

            return (
              <MenuItem
                // eslint-disable-next-line react/no-array-index-key -- Static menu items, stable order
                key={index}
                danger={item.danger}
                disabled={item.disabled}
                shortcut={item.shortcut}
                icon={
                  Icon && (
                    <Icon
                      strokeWidth={2}
                      className={`motion-normal transition-colors ${
                        item.disabled
                          ? 'text-muted-foreground'
                          : item.danger
                            ? 'text-destructive'
                            : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                    />
                  )
                }
                onClick={(e) => {
                  if (item.disabled) return
                  e.stopPropagation()
                  item.onClick()
                  onClose()
                }}
                className="group"
              >
                {item.label}
              </MenuItem>
            )
          })}
        </MenuSurface>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

export default ContextMenu
