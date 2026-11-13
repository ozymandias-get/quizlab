import type { PdfTab } from '@features/pdf/hooks/types'

import { MenuSurface } from '@app/components/ui/menu'
import { DURATION } from '@shared/lib/motion'
import {
  IconButton,
  ToolbarButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'

import { MoreHorizontal, X } from 'lucide-react'
import { motion } from 'motion/react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
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
  const [menuPlacement, setMenuPlacement] = useState<'top' | 'bottom'>('bottom')
  const [menuMaxHeight, setMenuMaxHeight] = useState(224)

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

  // Keep the panel inside the visible band: prefer below, flip above when the
  // trigger sits near the bottom, and cap the height to the chosen side.
  useLayoutEffect(() => {
    if (!isOpen) return
    const trigger = triggerRef.current
    const menu = surfaceRef.current
    if (!trigger || !menu || window.innerHeight <= 0) return

    const rect = trigger.getBoundingClientRect()
    const margin = 8
    const desired = Math.min(menu.scrollHeight || 224, 224)
    const spaceBelow = window.innerHeight - rect.bottom - margin
    const spaceAbove = rect.top - margin
    const openUp = spaceBelow < desired && spaceAbove > spaceBelow

    setMenuPlacement(openUp ? 'top' : 'bottom')
    setMenuMaxHeight(Math.max(96, Math.min(224, openUp ? spaceAbove : spaceBelow)))
  }, [isOpen])

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
          className={`z-dropdown absolute right-0 ${
            menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <MenuSurface
            ref={surfaceRef}
            role="dialog"
            aria-label={tr('tab_more', 'More tabs')}
            className="w-[min(300px,calc(100vw-16px))] min-w-[240px] overflow-y-auto"
            style={{ maxHeight: menuMaxHeight }}
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
                  className="group flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/10"
                  onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="focus-visible:ring-ring/70 flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
                        className="text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive size-7 shrink-0 rounded-md border border-transparent opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => {
                          onCloseTab(tab.id)
                          setIsOpen(false)
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
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
