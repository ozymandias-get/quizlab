import { memo, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { PdfTab } from '@features/pdf/hooks/usePdfSelection'

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

  return (
    <motion.button
      key={tab.id}
      type="button"
      layout
      whileHover={{
        y: -0.5,
        scale: 1.005,
        transition: { type: 'spring', stiffness: 380, damping: 24 }
      }}
      whileTap={{ scale: 0.99 }}
      className="glass-tier-3 glass-tier-control glass-interactive group relative flex h-8 min-w-0 max-w-[250px] items-center gap-2 rounded-full border px-3.5 pr-10 transition-colors transition-shadow duration-150"
      style={
        isActive
          ? {
              borderColor: 'rgba(16,185,129,0.44)',
              background: 'linear-gradient(145deg, rgba(16,185,129,0.08), rgba(255,255,255,0.02))',
              boxShadow: '0 0 18px -8px rgba(16,185,129,0.38), inset 0 1px 0 rgba(255,255,255,0.1)'
            }
          : {
              borderColor: 'rgba(255,255,255,0.08)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
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
    >
      <span className="flex items-center [&>svg]:w-3.5 [&>svg]:h-3.5 shrink-0 text-white/85">
        {getTabIcon(tab)}
      </span>

      {isEditing ? (
        <input
          ref={renameInputRef}
          value={editingValue}
          onChange={(event) => onEditingValueChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => onEditingBlur(tab.id, event.currentTarget.value)}
          onKeyDown={(event) => onEditingKeyDown(event, tab.id, editingValue)}
          placeholder={tr('tab_rename_placeholder', 'Tab name...')}
          className="min-w-0 w-full bg-transparent text-ql-12 text-white outline-none placeholder:text-white/45"
        />
      ) : (
        <span className="min-w-0 truncate text-ql-12 text-white/85">{label}</span>
      )}

      <span
        role="button"
        tabIndex={-1}
        aria-label={tr('tab_close', 'Close')}
        title={tr('tab_close', 'Close')}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md border border-white/15 bg-black/35 p-1 text-white/65 opacity-[0.55] transition-opacity hover:opacity-100 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onCloseTab(tab.id)
        }}
      >
        <X className="w-3 h-3" />
      </span>
    </motion.button>
  )
}

export default memo(PdfTabItem)
