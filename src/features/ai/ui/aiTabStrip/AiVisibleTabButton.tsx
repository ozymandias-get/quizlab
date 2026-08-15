import { Input } from '@app/components/ui/input'
import type { Tab } from '@app/providers/AiContext'
import { getAiIcon } from '@ui/components/Icons'

import { Pin, X } from 'lucide-react'
import { motion } from 'motion/react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useRef
} from 'react'

interface AiVisibleTabButtonProps {
  tab: Tab
  label: string
  tabColor: string
  isActive: boolean
  isEditing: boolean
  editingValue: string
  renameInputRef: RefObject<HTMLInputElement | null>
  skipBlurSaveRef: RefObject<boolean>
  tr: (key: string, fallback: string) => string
  iconKey?: string
  onSelect: (tabId: string) => void
  onBeginRename: (tabId: string) => void
  onContextMenu: (event: ReactMouseEvent, tabId: string) => void
  onEditingValueChange: (newValue: string) => void
  onCommitRename: (tabId: string, tabTitle: string) => void
  onCancelRename: () => void
  onTogglePin: (tabId: string) => void
  onClose: (tabId: string) => void
}

function AiVisibleTabButton({
  tab,
  label,
  tabColor: _tabColor,
  isActive,
  isEditing,
  editingValue,
  renameInputRef,
  skipBlurSaveRef,
  tr,
  iconKey,
  onSelect,
  onBeginRename,
  onContextMenu,
  onEditingValueChange,
  onCommitRename,
  onCancelRename,
  onTogglePin,
  onClose
}: AiVisibleTabButtonProps) {
  const tabId = tab.id
  const labelWidthRef = useRef<number | null>(null)
  const spanRef = useRef<HTMLSpanElement | null>(null)

  const labelRef = useCallback((el: HTMLSpanElement | null) => {
    if (el) {
      spanRef.current = el
      labelWidthRef.current = el.getBoundingClientRect().width
    }
  }, [])

  const handleClick = useCallback(() => onSelect(tabId), [onSelect, tabId])
  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onBeginRename(tabId)
    },
    [onBeginRename, tabId]
  )
  const handleContextMenu = useCallback(
    (event: ReactMouseEvent) => onContextMenu(event, tabId),
    [onContextMenu, tabId]
  )
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onEditingValueChange(event.target.value),
    [onEditingValueChange]
  )
  const handleInputClick = (event: ReactMouseEvent) => event.stopPropagation()
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (skipBlurSaveRef.current) {
        skipBlurSaveRef.current = false
        return
      }
      onCommitRename(tabId, event.currentTarget.value)
    },
    [skipBlurSaveRef, onCommitRename, tabId]
  )
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onCommitRename(tabId, editingValue)
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRename()
      }
    },
    [onCommitRename, tabId, editingValue, onCancelRename]
  )
  const handleTogglePin = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onTogglePin(tabId)
    },
    [onTogglePin, tabId]
  )
  const handleClose = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onClose(tabId)
    },
    [onClose, tabId]
  )

  return (
    <motion.div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(tabId)
        }
      }}
      whileHover={{
        y: -0.5,
        transition: { type: 'tween', duration: 0.12, ease: 'easeOut' }
      }}
      whileTap={{ scale: 0.99 }}
      className={`group focus-visible:ring-ring/40 relative flex h-8 max-w-[240px] min-w-0 cursor-pointer items-center gap-2 rounded-full border px-3 pr-14 transition-colors duration-150 outline-none select-none focus-visible:ring-2 ${
        isActive
          ? 'border-border bg-card text-foreground shadow-xs'
          : 'text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground border-transparent bg-transparent'
      }`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={label}
    >
      {isActive && (
        <div className="bg-primary/70 pointer-events-none absolute -bottom-px left-1/2 h-0.5 w-1/2 -translate-x-1/2 rounded-full" />
      )}

      <span className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors">
        {getAiIcon(iconKey || tab.modelId) || (
          <span className="text-ql-10 font-bold uppercase">{label.charAt(0)}</span>
        )}
      </span>

      {isEditing ? (
        <Input
          ref={renameInputRef}
          value={editingValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={tr('tab_rename_placeholder', 'Tab name...')}
          className="text-ql-12 text-foreground h-auto min-w-0 border-none bg-transparent px-0 shadow-none"
          style={
            labelWidthRef.current ? { width: labelWidthRef.current, maxWidth: 240 } : undefined
          }
        />
      ) : (
        <span
          ref={labelRef}
          className={`text-ql-12 min-w-0 truncate font-medium ${
            isActive ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {label}
        </span>
      )}

      <div className="absolute top-1/2 right-1.5 z-10 flex -translate-y-1/2 items-center gap-1">
        <span
          role="button"
          tabIndex={-1}
          aria-label={tab.pinned ? tr('tab_unpin', 'Unpin') : tr('tab_pin', 'Pin')}
          title={tab.pinned ? tr('tab_pinned', 'Pinned') : tr('tab_pin', 'Pin')}
          className={`flex items-center justify-center rounded-md border p-1 transition-opacity ${
            tab.pinned
              ? 'border-ring/50 bg-accent text-foreground'
              : 'border-border/50 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
          }`}
          onClick={handleTogglePin}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onTogglePin(tabId)
            }
          }}
        >
          <Pin className="h-3 w-3" fill={tab.pinned ? 'currentColor' : 'none'} />
        </span>

        <span
          role="button"
          tabIndex={-1}
          aria-label={tr('tab_close', 'Close')}
          title={tr('tab_close', 'Close')}
          className="border-border/50 bg-card/60 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center rounded-md border p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          onClick={handleClose}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onClose(tabId)
            }
          }}
        >
          <X className="h-3 w-3" />
        </span>
      </div>
    </motion.div>
  )
}

export default memo(AiVisibleTabButton)
