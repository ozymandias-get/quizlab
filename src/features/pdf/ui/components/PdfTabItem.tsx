import type { PdfTab } from '@features/pdf/hooks/types'

import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import { DURATION } from '@shared/lib/motion'

import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, type MouseEvent as ReactMouseEvent, type RefObject, useCallback } from 'react'

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

  const tabClasses = `focus-visible:ring-ring/40 motion-normal relative flex h-8 max-w-[240px] min-w-0 items-center gap-2 rounded-full border px-3 pr-8 transition-colors outline-none select-none focus-visible:ring-2 ${
    isActive
      ? 'border-border bg-card text-foreground shadow-xs'
      : 'text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground border-transparent bg-transparent'
  }`

  // Stable per-tab ref callback (memo-safe: identity depends only on the
  // stable `buttonRef` and the immutable `tab.id`).
  const handleButtonRef = useCallback(
    (el: HTMLButtonElement | null) => buttonRef?.(el, tab.id),
    [buttonRef, tab.id]
  )

  const handleClose = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onCloseTab(tab.id)
    },
    [onCloseTab, tab.id]
  )

  const tabLabel = (
    <>
      {isActive && (
        <div className="bg-primary/70 pointer-events-none absolute -bottom-px left-1/2 h-0.5 w-1/2 -translate-x-1/2 rounded-full" />
      )}
      <span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5">
        {getTabIcon(tab)}
      </span>
      <span
        className={`text-ql-12 min-w-0 truncate font-medium ${
          isActive ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
    </>
  )

  return (
    <div className="group relative shrink-0">
      {isEditing ? (
        // Rename mode: a plain tab container (not a <button>) so the text
        // input is never nested inside an interactive button. The input
        // itself receives focus; the container is not an extra tab stop.
        <div
          role="tab"
          aria-selected={isActive}
          tabIndex={-1}
          className={tabClasses}
          onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
        >
          <span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5">
            {getTabIcon(tab)}
          </span>
          <Input
            ref={renameInputRef}
            value={editingValue}
            onChange={(event) => onEditingValueChange(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => onEditingBlur(tab.id, event.currentTarget.value)}
            onKeyDown={(event) => onEditingKeyDown(event, tab.id, editingValue)}
            placeholder={tr('tab_rename_placeholder', 'Tab name...')}
            aria-label={label}
            className="text-ql-12 text-foreground h-auto min-w-0 border-none bg-transparent px-0 shadow-none"
          />
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              key={tab.id}
              ref={handleButtonRef}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              whileHover={{
                y: -0.5,
                transition: { type: 'tween', duration: DURATION.normal, ease: 'easeOut' }
              }}
              whileTap={{ scale: 0.99 }}
              className={tabClasses}
              onClick={() => onSetActiveTab(tab.id)}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onBeginRename(tab)
              }}
              onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
              aria-label={label}
            >
              {tabLabel}
            </motion.button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            type="button"
            size="compact"
            variant="ghost"
            aria-label={tr('tab_close', 'Close')}
            onClick={handleClose}
            className={`border-border/50 bg-card/60 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive motion-normal absolute top-1/2 right-1 z-10 size-6 -translate-y-1/2 rounded-md border p-0 transition-opacity focus-visible:opacity-100 ${
              isActive
                ? 'opacity-100'
                : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
            }`}
          >
            <X className="h-3 w-3" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>{tr('tab_close', 'Close')}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export default memo(PdfTabItem)
