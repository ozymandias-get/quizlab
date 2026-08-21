import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import type { Tab } from '@app/providers/AiContext'
import { TabPillContainer, TabPillIcon, TabPillLabel } from '@shared/ui/components/primitives'
import { getAiIcon } from '@ui/components/Icons'

import { Pin, X } from 'lucide-react'
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

  // AI pill uses the same visual as PDF pill but has inline rename + pin controls.
  // We render a <div role=tab> container here (not Button) because edit mode
  // nests an Input and pin/close buttons absolutely — nesting buttons is invalid.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TabPillContainer
          isActive={isActive}
          className="group cursor-pointer pr-20"
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(tabId)
            }
          }}
          // make container focusable for keyboard roving (handled by parent)
          tabIndex={0}
          aria-label={label}
        >
          <TabPillIcon>
            {getAiIcon(iconKey || tab.modelId) || (
              <span className="text-ql-10 font-bold uppercase">{label.charAt(0)}</span>
            )}
          </TabPillIcon>

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
            <TabPillLabel ref={labelRef} isActive={isActive}>
              {label}
            </TabPillLabel>
          )}

          <div className="absolute top-1/2 right-1 z-10 flex -translate-y-1/2 items-center gap-1">
            <IconButton
              type="button"
              size="compact"
              variant="ghost"
              aria-label={tab.pinned ? tr('tab_unpin', 'Unpin') : tr('tab_pin', 'Pin')}
              onClick={handleTogglePin}
              className={`size-7 rounded-md border p-0 ${
                tab.pinned
                  ? 'border-ring/50 bg-accent text-foreground opacity-100'
                  : 'border-border/50 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary opacity-60 group-hover:opacity-80 hover:opacity-100'
              }`}
            >
              <Pin className="h-3.5 w-3.5" fill={tab.pinned ? 'currentColor' : 'none'} />
            </IconButton>

            <IconButton
              type="button"
              size="compact"
              variant="ghost"
              aria-label={tr('tab_close', 'Close')}
              onClick={handleClose}
              className={`text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive size-7 rounded-md border p-0 transition-opacity focus-visible:opacity-100 ${
                isActive
                  ? 'opacity-80 hover:opacity-100'
                  : 'opacity-60 group-hover:opacity-80 hover:opacity-100'
              } border-border/50 bg-card/60`}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </TabPillContainer>
      </TooltipTrigger>
      <TooltipContent>
        {label} — {tr('tab_rename_hint', 'Double-click to rename')}
      </TooltipContent>
    </Tooltip>
  )
}

export default memo(AiVisibleTabButton)
