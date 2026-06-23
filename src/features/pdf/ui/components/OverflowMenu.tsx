import type { PdfTab } from '@features/pdf/hooks/types'

import { ToolbarButton } from '@shared/ui/components/primitives'

import { MoreHorizontal, X } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react'

interface OverflowMenuProps {
  overflowTabs: PdfTab[]
  getTabLabel: (tab: PdfTab) => string
  getTabIcon: (tab: PdfTab) => React.ReactNode
  tr: (key: string, fallback: string) => string
  onSetActiveTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onOpenContextMenu: (event: ReactMouseEvent, tabId: string) => void
}

function OverflowMenu({
  overflowTabs,
  getTabLabel,
  getTabIcon,
  tr,
  onSetActiveTab,
  onCloseTab,
  onOpenContextMenu
}: OverflowMenuProps) {
  const overflowRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (overflowRef.current && !overflowRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <div ref={overflowRef} className="relative ml-auto shrink-0">
      <ToolbarButton
        icon={MoreHorizontal}
        className="!w-auto min-w-[36px] px-1.5 text-white/75 hover:bg-white/[0.08] hover:text-white"
        tooltip={tr('tab_more', 'More tabs')}
        isActive={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      />

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className="glass-tier-2 z-dropdown absolute top-10 right-0 max-h-56 w-[250px] overflow-y-auto rounded-xl border-white/[0.12] p-1.5"
        >
          {overflowTabs.map((tab) => {
            const label = getTabLabel(tab)
            return (
              <button
                key={tab.id}
                type="button"
                className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 hover:bg-white/[0.15]"
                onClick={() => {
                  onSetActiveTab(tab.id)
                  setIsOpen(false)
                }}
                onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
                title={label}
                aria-label={label}
              >
                <span className="flex shrink-0 items-center text-white/85 [&>svg]:h-3.5 [&>svg]:w-3.5">
                  {getTabIcon(tab)}
                </span>
                <span className="text-ql-12 min-w-0 flex-1 truncate text-white/85">{label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={tr('tab_close', 'Close tab')}
                  className="shrink-0 rounded-md border border-white/15 bg-black/35 p-1 text-white/60 opacity-0 transition-all group-hover:opacity-100 hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-400"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onCloseTab(tab.id)
                    setIsOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      onCloseTab(tab.id)
                      setIsOpen(false)
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default memo(OverflowMenu)
