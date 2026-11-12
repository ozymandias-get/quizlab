import type { Tab } from '@app/providers/ai-context'
import {
  IconButton,
  TabPillContainer,
  TabPillIcon,
  TabPillLabel,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'
import { getAiIcon } from '@ui/components/Icons'

import { X } from 'lucide-react'
import { memo, type MouseEvent as ReactMouseEvent, useCallback, useRef } from 'react'

type AiTabDropSide = 'before' | 'after'

interface AiVisibleTabButtonProps {
  tab: Tab
  label: string
  isActive: boolean
  /** This pill is the one being dragged by the pointer. */
  isDragging: boolean
  /** Where the dragged pill would be inserted relative to this one, or null. */
  dropSide: AiTabDropSide | null
  tr: (key: string, fallback: string) => string
  iconKey?: string
  onSelect: (tabId: string) => void
  onContextMenu: (event: ReactMouseEvent, tabId: string) => void
  onClose: (tabId: string) => void
}

function AiVisibleTabButton({
  tab,
  label,
  isActive,
  isDragging,
  dropSide,
  tr,
  iconKey,
  onSelect,
  onContextMenu,
  onClose
}: AiVisibleTabButtonProps) {
  const tabId = tab.id

  // Icons resolve asynchronously from the model registry. Once a tab has shown
  // its real logo, keep that node mounted while a reload re-resolves, so the
  // pill never flickers back to the letter fallback between sessions.
  const iconLookupKey = iconKey || tab.modelId
  const liveIcon = getAiIcon(iconLookupKey)
  const lastIconRef = useRef(liveIcon)
  if (liveIcon) lastIconRef.current = liveIcon
  const tabIcon = liveIcon ?? lastIconRef.current

  const handleClick = useCallback(() => onSelect(tabId), [onSelect, tabId])
  const handleContextMenu = useCallback(
    (event: ReactMouseEvent) => onContextMenu(event, tabId),
    [onContextMenu, tabId]
  )
  const handleClose = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onClose(tabId)
    },
    [onClose, tabId]
  )

  // A tab is a <div role="tab"> rather than a button because it nests the close
  // control. The active tab keeps that control visible without hover, so its
  // width is reserved permanently; hovering paints the same reserved gap.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TabPillContainer
          isActive={isActive}
          data-ai-tab=""
          data-tab-id={tab.id}
          draggable
          className={`group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-45' : ''} ${
            dropSide === 'before'
              ? 'before:bg-primary before:absolute before:inset-y-1 before:-left-0.5 before:z-10 before:w-0.5 before:rounded-full'
              : ''
          } ${
            dropSide === 'after'
              ? 'after:bg-primary after:absolute after:inset-y-1 after:-right-0.5 after:z-10 after:w-0.5 after:rounded-full'
              : ''
          } ${isActive ? 'pr-[4.5rem]' : 'pr-3 group-focus-within:pr-[4.5rem] group-hover:pr-[4.5rem]'}`}
          onClick={handleClick}
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
            {tabIcon || <span className="text-ql-10 font-bold uppercase">{label.charAt(0)}</span>}
          </TabPillIcon>

          <TabPillLabel isActive={isActive} data-ai-tab-label="">
            {label}
          </TabPillLabel>

          <div className="absolute top-1/2 right-1 z-10 flex -translate-y-1/2 items-center gap-1">
            <IconButton
              type="button"
              size="compact"
              variant="ghost"
              aria-label={tr('tab_close', 'Close')}
              onClick={handleClose}
              className={`border-border/50 bg-card/60 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive size-7 rounded-md border p-0 transition-opacity focus-visible:opacity-100 ${
                isActive
                  ? 'opacity-70 hover:opacity-100'
                  : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:opacity-100'
              }`}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </TabPillContainer>
      </TooltipTrigger>
      <TooltipContent side="top" avoidCollisions={false}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export default memo(AiVisibleTabButton)
