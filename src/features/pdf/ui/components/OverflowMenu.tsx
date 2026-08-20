import type { PdfTab } from '@features/pdf/hooks/types'

import { IconButton } from '@app/components/ui/icon-button'
import { MenuSurface } from '@app/components/ui/menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import { DURATION } from '@shared/lib/motion'
import { ToolbarButton } from '@shared/ui/components/primitives'

import { MoreHorizontal, X } from 'lucide-react'
import { motion } from 'motion/react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'

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
  const surfaceRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const [isOpen, setIsOpen] = useState(false)

  const closeAndRestoreFocus = useCallback(() => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (overflowRef.current && !overflowRef.current.contains(target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAndRestoreFocus()
      }
    }

    const surface = surfaceRef.current
    surface?.querySelector<HTMLElement>('button:not([disabled])')?.focus()

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closeAndRestoreFocus])

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    const active = document.activeElement
    if (!active || active === document.body || !active.isConnected) {
      triggerRef.current?.focus()
    }
  }, [isOpen])

  return (
    <div ref={overflowRef} className="relative ml-auto shrink-0">
      <ToolbarButton
        ref={triggerRef}
        icon={MoreHorizontal}
        className="!w-auto min-w-[32px] px-1.5"
        tooltip={tr('tab_more', 'More tabs')}
        isActive={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      />

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: DURATION.normal }}
          className="z-dropdown absolute top-10 right-0"
        >
          <MenuSurface
            ref={surfaceRef}
            role="dialog"
            aria-label={tr('tab_more', 'More tabs')}
            className="max-h-56 w-[240px] overflow-y-auto"
            onKeyDown={(event) => {
              // The dialog sits inside the tablist row, whose roving handler
              // owns ArrowLeft/ArrowRight/Home/End — keep those keys local.
              if (
                event.key === 'ArrowLeft' ||
                event.key === 'ArrowRight' ||
                event.key === 'Home' ||
                event.key === 'End'
              ) {
                event.stopPropagation()
              }
            }}
          >
            {overflowTabs.map((tab) => {
              const label = getTabLabel(tab)
              return (
                <div
                  key={tab.id}
                  role="group"
                  aria-label={label}
                  className="group hover:bg-muted flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors"
                  onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-popover-foreground focus-visible:ring-ring/40 flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        onClick={() => {
                          onSetActiveTab(tab.id)
                          setIsOpen(false)
                        }}
                        aria-label={label}
                      >
                        <span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5">
                          {getTabIcon(tab)}
                        </span>
                        <span className="text-ql-12 text-foreground min-w-0 flex-1 truncate font-medium">
                          {label}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <IconButton
                        type="button"
                        size="compact"
                        variant="ghost"
                        aria-label={tr('tab_close', 'Close tab')}
                        className="text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                        onClick={() => {
                          onCloseTab(tab.id)
                          setIsOpen(false)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </IconButton>
                    </TooltipTrigger>
                    <TooltipContent>{tr('tab_close', 'Close tab')}</TooltipContent>
                  </Tooltip>
                </div>
              )
            })}
          </MenuSurface>
        </motion.div>
      )}
    </div>
  )
}

export default memo(OverflowMenu)
