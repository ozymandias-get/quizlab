import type { PdfTab } from '@features/pdf/hooks/types'

import { Input } from '@app/components/ui/input'

import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, type MouseEvent as ReactMouseEvent, type RefObject, useEffect, useRef } from 'react'

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
  onEditingValueChange: (value: string) => void
  onEditingBlur: (tabId: string, value: string) => void
  onEditingKeyDown: (event: React.KeyboardEvent, tabId: string, value: string) => void
  renameInputRef?: RefObject<HTMLInputElement | null>
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
  renameInputRef
}: PdfTabItemProps) {
  const label = getTabLabel(tab)

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

    const handler = (e: PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onCloseTabRef.current(tab.id)
    }

    el.addEventListener('pointerdown', handler)
    return () => el.removeEventListener('pointerdown', handler)
    // tab.id değiştiğinde eski listener kalkıp yenisi eklenir.
    // onCloseTabRef üzerinden okunduğu için dep olarak eklenmez.
  }, [tab.id])

  return (
    <motion.button
      key={tab.id}
      type="button"
      // layout özelliği kaldırıldı: her sekme butonunda FLIP animasyonu
      // tüm sekmelerin sınır kutularını senkron okutarak ağır reflow
      // yükü oluşturuyordu. Animasyon ihtiyacı durumunda layout
      // yalnızca aktif-sekme göstergesine (layoutId) eklenmeli.
      whileHover={{
        y: -0.5,
        scale: 1.005,
        transition: { type: 'spring', stiffness: 380, damping: 24 }
      }}
      whileTap={{ scale: 0.99 }}
      className="glass-tier-3 glass-tier-control glass-interactive group focus-visible:ring-offset-background relative flex h-8 max-w-[250px] min-w-0 items-center gap-2 rounded-full border px-3.5 pr-10 transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
      style={
        isActive
          ? {
              borderColor: 'oklch(0.7 0.15 160 / 0.44)',
              boxShadow:
                '0 0 18px -8px oklch(0.7 0.15 160 / 0.38), inset 0 1px 0 oklch(1 0 0 / 0.1)'
            }
          : {
              borderColor: 'oklch(1 0 0 / 0.08)',
              boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.05)'
            }
      }
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
      <div
        className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-150"
        style={{
          opacity: isActive ? 1 : 0,
          background: 'linear-gradient(145deg, oklch(0.7 0.15 160 / 0.08), oklch(1 0 0 / 0.02))'
        }}
      />
      <span className="flex shrink-0 items-center text-white/85 [&>svg]:h-3.5 [&>svg]:w-3.5">
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
          className="text-ql-12 h-auto min-w-0 border-none bg-transparent px-0 shadow-none"
        />
      ) : (
        <span className="text-ql-12 min-w-0 truncate text-white/85">{label}</span>
      )}

      <span
        ref={closeBtnRef}
        role="button"
        tabIndex={-1}
        aria-label={tr('tab_close', 'Close')}
        title={tr('tab_close', 'Close')}
        className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center justify-center rounded-md border border-white/15 bg-black/35 p-1 text-white/65 opacity-[0.55] transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-white hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </span>
    </motion.button>
  )
}

export default memo(PdfTabItem)
