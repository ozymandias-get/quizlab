import type { PdfTab } from '@features/pdf/hooks/types'

import { Input } from '@app/components/ui/input'

import { X } from 'lucide-react'
import { motion } from 'motion/react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef
} from 'react'

interface PdfTabItemProps {
  tab: PdfTab
  isActive: boolean
  isEditing: boolean
  editingValue: string
  getTabLabel: (tab: PdfTab) => string
  getTabIcon: (tab: PdfTab) => React.ReactNode
  tr: (key: string, fallback: string) => string
  onSetActiveTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onBeginRename: (tab: PdfTab) => void
  onOpenContextMenu: (event: ReactMouseEvent, tabId: string) => void
  onEditingValueChange: (newValue: string) => void
  onEditingBlur: (tabId: string, tabTitle: string) => void
  onEditingKeyDown: (event: React.KeyboardEvent, tabId: string, tabTitle: string) => void
  renameInputRef?: RefObject<HTMLInputElement | null>
  buttonRef?: (el: HTMLButtonElement | null, tabId: string) => void
}

function PdfTabItem({
  tab,
  isActive,
  isEditing,
  editingValue,
  getTabLabel,
  getTabIcon,
  tr,
  onSetActiveTab,
  onCloseTab,
  onBeginRename,
  onOpenContextMenu,
  onEditingValueChange,
  onEditingBlur,
  onEditingKeyDown,
  renameInputRef,
  buttonRef
}: PdfTabItemProps) {
  const label = getTabLabel(tab)

  // Stable per-tab ref callback (memo-safe: identity depends only on the
  // stable `buttonRef` and the immutable `tab.id`).
  const handleButtonRef = useCallback(
    (el: HTMLButtonElement | null) => buttonRef?.(el, tab.id),
    [buttonRef, tab.id]
  )

  /* ── Native pointerdown on the X button ──
     Framer Motion attaches native DOM event listeners to the parent
     <motion.button> to power whileTap / whileHover gestures. React's
     synthetic onPointerDown + stopPropagation cannot prevent these
     native listeners from receiving the event, because the native event
     has already propagated to the parent element by the time React's
     root-level delegation processes it.

     Solution: use a ref + native addEventListener('pointerdown') on the
     close <span> itself, and call stopPropagation() on the native event
     BEFORE it reaches the parent <motion.button>. This prevents Framer
     Motion's whileTap (scale: 0.99) from ever starting, eliminating the
     momentary "zoom" glitch when a tab is closed.                          */
  const closeBtnRef = useRef<HTMLSpanElement>(null)
  const onCloseTabRef = useRef(onCloseTab)
  onCloseTabRef.current = onCloseTab

  useEffect(() => {
    const el = closeBtnRef.current
    if (!el) return

    const handlePointerUp = (e: PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onCloseTabRef.current(tab.id)
    }

    el.addEventListener('pointerdown', handlePointerUp)
    return () => el.removeEventListener('pointerdown', handlePointerUp)
    // tab.id değiştiğinde eski listener kalkıp yenisi eklenir.
    // onCloseTabRef üzerinden okunduğu için dep olarak eklenmez.
  }, [tab.id])

  return (
    <motion.button
      key={tab.id}
      ref={handleButtonRef}
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      whileHover={{
        y: -0.5,
        transition: { type: 'tween', duration: 0.12, ease: 'easeOut' }
      }}
      whileTap={{ scale: 0.99 }}
      className={`group focus-visible:ring-ring/40 relative flex h-8 max-w-[240px] min-w-0 items-center gap-2 rounded-full border px-3 pr-8 transition-colors duration-150 outline-none select-none focus-visible:ring-2 ${
        isActive
          ? 'border-border bg-card text-foreground shadow-xs'
          : 'text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground border-transparent bg-transparent'
      }`}
      onClick={() => onSetActiveTab(tab.id)}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onBeginRename(tab)
      }}
      onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
      title={label}
      aria-label={label}
    >
      {isActive && (
        <div className="bg-primary/70 pointer-events-none absolute -bottom-px left-1/2 h-0.5 w-1/2 -translate-x-1/2 rounded-full" />
      )}
      <span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5">
        {getTabIcon(tab)}
      </span>

      {isEditing ? (
        <Input
          ref={renameInputRef}
          value={editingValue}
          onChange={(event) => onEditingValueChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => onEditingBlur(tab.id, event.currentTarget.value)}
          onKeyDown={(event) => onEditingKeyDown(event, tab.id, editingValue)}
          placeholder={tr('tab_rename_placeholder', 'Tab name...')}
          className="text-ql-12 text-foreground h-auto min-w-0 border-none bg-transparent px-0 shadow-none"
        />
      ) : (
        <span
          className={`text-ql-12 min-w-0 truncate font-medium ${
            isActive ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {label}
        </span>
      )}

      <span
        ref={closeBtnRef}
        role="button"
        tabIndex={-1}
        aria-label={tr('tab_close', 'Close')}
        title={tr('tab_close', 'Close')}
        className="border-border/50 bg-card/60 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center justify-center rounded-md border p-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </span>
    </motion.button>
  )
}

export default memo(PdfTabItem)
