import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { motion } from 'framer-motion'
import { Pin, X } from 'lucide-react'
import type { Tab } from '@app/providers/AiContext'
import { getAiIcon } from '@ui/components/Icons'

interface AiVisibleTabButtonProps {
  tab: Tab
  label: string
  tabColor: string
  isActive: boolean
  isEditing: boolean
  isHovered: boolean
  editingValue: string
  renameInputRef: RefObject<HTMLInputElement | null>
  skipBlurSaveRef: RefObject<boolean>
  tr: (key: string, fallback: string) => string
  iconKey?: string
  onSelect: () => void
  onBeginRename: () => void
  onContextMenu: (event: ReactMouseEvent) => void
  onHoverStart: () => void
  onHoverEnd: () => void
  onEditingValueChange: (value: string) => void
  onCommitRename: (value: string) => void
  onCancelRename: () => void
  onTogglePin: () => void
  onClose: () => void
}

function AiVisibleTabButton({
  tab,
  label,
  tabColor,
  isActive,
  isEditing,
  isHovered,
  editingValue,
  renameInputRef,
  skipBlurSaveRef,
  tr,
  iconKey,
  onSelect,
  onBeginRename,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
  onEditingValueChange,
  onCommitRename,
  onCancelRename,
  onTogglePin,
  onClose
}: AiVisibleTabButtonProps) {
  return (
    <motion.button
      type="button"
      layout
      whileHover={{
        y: -0.5,
        scale: 1.005,
        transition: { type: 'spring', stiffness: 400, damping: 26 }
      }}
      whileTap={{ scale: 0.99 }}
      className="relative flex h-8 min-w-0 max-w-[260px] items-center gap-2 rounded-full border px-3.5 pr-16 transition-all duration-200"
      style={
        isActive
          ? {
              borderColor: `${tabColor}66`,
              background: `linear-gradient(145deg, ${tabColor}22, rgba(255,255,255,0.05))`,
              boxShadow: `0 0 18px -8px ${tabColor}66, inset 0 1px 0 rgba(255,255,255,0.1)`
            }
          : {
              borderColor: 'rgba(255,255,255,0.08)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }
      }
      onClick={onSelect}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onBeginRename()
      }}
      onContextMenu={onContextMenu}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      title={label}
    >
      <span className="text-white/90 shrink-0">
        {getAiIcon(iconKey || tab.modelId) || (
          <span className="text-[10px] font-bold uppercase">{label.charAt(0)}</span>
        )}
      </span>

      {isEditing ? (
        <input
          ref={renameInputRef}
          value={editingValue}
          onChange={(event) => onEditingValueChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => {
            if (skipBlurSaveRef.current) {
              skipBlurSaveRef.current = false
              return
            }
            onCommitRename(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onCommitRename(editingValue)
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              onCancelRename()
            }
          }}
          placeholder={tr('tab_rename_placeholder', 'Tab name...')}
          className="min-w-0 w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/45"
        />
      ) : (
        <span className="min-w-0 truncate text-[11px] text-white/85">{label}</span>
      )}

      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1">
        {(tab.pinned || isHovered) && (
          <span
            role="button"
            tabIndex={-1}
            aria-label={tab.pinned ? tr('tab_unpin', 'Unpin') : tr('tab_pin', 'Pin')}
            title={tab.pinned ? tr('tab_pinned', 'Pinned') : tr('tab_pin', 'Pin')}
            className={`flex items-center justify-center rounded-md border p-1 transition-colors ${
              tab.pinned
                ? 'text-white bg-white/15 border-white/25'
                : 'text-white/60 bg-black/35 border-white/15 hover:text-white'
            }`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onTogglePin()
            }}
          >
            <Pin className="w-3 h-3" fill={tab.pinned ? 'currentColor' : 'none'} />
          </span>
        )}

        {isHovered && (
          <span
            role="button"
            tabIndex={-1}
            aria-label={tr('tab_close', 'Close')}
            title={tr('tab_close', 'Close')}
            className="flex items-center justify-center rounded-md border border-white/15 bg-black/35 p-1 text-white/65 hover:text-white transition-colors"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            }}
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </div>
    </motion.button>
  )
}

export default AiVisibleTabButton
