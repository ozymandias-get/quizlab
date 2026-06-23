import { type LucideIcon } from 'lucide-react'
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

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y })
  const [isReady, setIsReady] = useState(false)

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
      let newX = x
      let newY = y

      if (x + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 10
      }
      if (y + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 10
      }

      setAdjustedPosition({ x: newX, y: newY })
      setIsReady(true)
    }
  }, [x, y])

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={isReady ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: -5 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: 0.1, ease: 'easeOut' }}
        className="z-top fixed origin-top-left"
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
        <div className="min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-zinc-900/90 p-1.5 shadow-2xl ring-1 shadow-black/80 ring-white/5 backdrop-blur-lg">
          {items.map((item, index) => {
            if (item.separator) {
              // eslint-disable-next-line react/no-array-index-key
              return <div key={index} className="mx-2 my-1 h-[1px] bg-white/10" />
            }

            const Icon = item.icon

            return (
              <button
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                type="button"
                onClick={(e) => {
                  if (item.disabled) return
                  e.stopPropagation()
                  item.onClick()
                  onClose()
                }}
                disabled={item.disabled}
                className={`text-ql-14 group relative flex w-full items-center justify-between overflow-hidden rounded-lg px-3 py-2 transition-colors transition-shadow duration-150 ${
                  item.disabled
                    ? 'cursor-not-allowed text-stone-600 opacity-40'
                    : item.danger
                      ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                      : 'text-stone-300 hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                } `}
              >
                <div className="relative z-10 flex items-center gap-3">
                  {Icon && (
                    <Icon
                      size={15}
                      strokeWidth={2}
                      className={`transition-colors duration-200 ${
                        item.disabled
                          ? 'text-stone-600'
                          : item.danger
                            ? 'text-red-400'
                            : 'text-stone-500 group-hover:text-cyan-400'
                      }`}
                    />
                  )}
                  <span className="font-medium tracking-wide">{item.label}</span>
                </div>
                {item.shortcut && (
                  <span
                    className={`text-ql-10 relative z-10 font-semibold tracking-wider uppercase opacity-50 ${
                      item.danger ? 'text-red-400' : 'text-stone-500 group-hover:text-stone-400'
                    }`}
                  >
                    {item.shortcut}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
