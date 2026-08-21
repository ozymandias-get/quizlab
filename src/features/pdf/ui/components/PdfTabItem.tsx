import type { PdfTab } from '@features/pdf/hooks/types'

import { IconButton } from '@app/components/ui/icon-button'
import { Input } from '@app/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@app/components/ui/tooltip'
import {
  TabPill,
  TabPillContainer,
  TabPillIcon,
  TabPillLabel
} from '@shared/ui/components/primitives'

import { X } from 'lucide-react'
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
      <TabPillIcon>{getTabIcon(tab)}</TabPillIcon>
      <TabPillLabel isActive={isActive}>{label}</TabPillLabel>
    </>
  )

  return (
    <div className="group relative shrink-0">
      {isEditing ? (
        <TabPillContainer
          isActive={isActive}
          onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
        >
          <TabPillIcon>{getTabIcon(tab)}</TabPillIcon>
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
        </TabPillContainer>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <TabPill
              key={tab.id}
              ref={handleButtonRef}
              isActive={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSetActiveTab(tab.id)}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onBeginRename(tab)
              }}
              onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
              aria-label={label}
              withControls
            >
              {tabLabel}
            </TabPill>
          </TooltipTrigger>
          <TooltipContent>
            {label} — {tr('tab_rename_hint', 'Double-click to rename')}
          </TooltipContent>
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
            className={`border-border/50 bg-card/60 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive motion-normal absolute inset-y-0 right-1 z-10 my-auto size-7 rounded-md border p-0 transition-opacity focus-visible:opacity-100 ${
              isActive
                ? 'opacity-80 hover:opacity-100'
                : 'opacity-60 group-hover:opacity-80 hover:opacity-100'
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>{tr('tab_close', 'Close')}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export default memo(PdfTabItem)
