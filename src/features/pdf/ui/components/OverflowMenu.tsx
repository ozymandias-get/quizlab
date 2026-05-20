import { memo, useRef, useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react'
import { motion } from 'framer-motion'
import { MoreHorizontal, X } from 'lucide-react'
import type { PdfTab } from '@features/pdf/hooks/usePdfSelection'
import { ToolbarButton } from '@shared/ui/components/primitives'

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
          className="glass-tier-2 absolute right-0 top-10 z-40 w-[250px] max-h-56 overflow-y-auto rounded-xl border-white/[0.12] p-1.5"
        >
          {overflowTabs.map((tab) => {
            const label = getTabLabel(tab)
            return (
              <button
                key={tab.id}
                type="button"
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10 transition-colors text-left"
                onClick={() => {
                  onSetActiveTab(tab.id)
                  setIsOpen(false)
                }}
                onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
                title={label}
              >
                <span className="flex items-center [&>svg]:w-3.5 [&>svg]:h-3.5 shrink-0 text-white/85">
                  {getTabIcon(tab)}
                </span>
                <span className="min-w-0 flex-1 truncate text-ql-12 text-white/85">{label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  className="shrink-0 rounded-md border border-white/15 bg-black/35 p-1 text-white/60 hover:text-white transition-colors"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onCloseTab(tab.id)
                  }}
                >
                  <X className="w-3 h-3" />
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
