import type { PdfTab } from '@features/pdf/hooks/types'

import {
  IconButton,
  TabPill,
  TabPillIcon,
  TabPillLabel,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'

import { X } from 'lucide-react'
import { memo, type MouseEvent as ReactMouseEvent, useCallback } from 'react'

type PdfTabDropSide = 'before' | 'after'

interface PdfTabItemProps {
  tab: PdfTab
  isActive: boolean
  /** This pill is the one being dragged by the pointer. */
  isDragging: boolean
  /** Where the dragged pill would be inserted relative to this one, or null. */
  dropSide: PdfTabDropSide | null
  getTabLabel: (tab: PdfTab) => string
  getTabIcon: (tab: PdfTab) => React.ReactNode
  tr: (key: string, fallback: string) => string
  onSetActiveTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onOpenContextMenu: (event: ReactMouseEvent, tabId: string) => void
  buttonRef?: (el: HTMLButtonElement | null, tabId: string) => void
}

function PdfTabItem({
  tab,
  isActive,
  isDragging,
  dropSide,
  getTabLabel,
  getTabIcon,
  tr,
  onSetActiveTab,
  onCloseTab,
  onOpenContextMenu,
  buttonRef
}: PdfTabItemProps) {
  const label = getTabLabel(tab)

  // Stable per-tab ref callback (memo-safe: identity depends only on the
  // stable `buttonRef` and the immutable `tab.id`).
  const handleButtonRef = useCallback(
    (el: HTMLButtonElement | null) => buttonRef?.(el, tab.id),
    [buttonRef, tab.id]
  )

  const handleActivate = useCallback(() => onSetActiveTab(tab.id), [onSetActiveTab, tab.id])

  const handleClose = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onCloseTab(tab.id)
    },
    [onCloseTab, tab.id]
  )

  // Long file names shrink within the measured capacity instead of pushing the
  // add/overflow controls out of the row.
  return (
    <div
      className={`group relative min-w-0 ${isDragging ? 'opacity-45' : ''} ${
        dropSide === 'before'
          ? 'before:bg-primary before:absolute before:inset-y-1 before:-left-0.5 before:z-10 before:w-0.5 before:rounded-full'
          : ''
      } ${
        dropSide === 'after'
          ? 'after:bg-primary after:absolute after:inset-y-1 after:-right-0.5 after:z-10 after:w-0.5 after:rounded-full'
          : ''
      }`}
      data-pdf-tab=""
      data-tab-id={tab.id}
      draggable
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <TabPill
            key={tab.id}
            ref={handleButtonRef}
            isActive={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={handleActivate}
            onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
            aria-label={label}
            withControls
          >
            <TabPillIcon>{getTabIcon(tab)}</TabPillIcon>
            <TabPillLabel isActive={isActive} data-pdf-tab-label="">
              {label}
            </TabPillLabel>
          </TabPill>
        </TooltipTrigger>
        <TooltipContent side="top" avoidCollisions={false}>
          {label}
        </TooltipContent>
      </Tooltip>

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
                ? 'opacity-70 hover:opacity-100'
                : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:opacity-100'
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent side="top" avoidCollisions={false}>
          {tr('tab_close', 'Close')}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export default memo(PdfTabItem)
