import type { PdfTab } from '@features/pdf/hooks/types'

import { Input } from '@app/components/ui/input'
import {
  IconButton,
  TabPill,
  TabPillContainer,
  TabPillIcon,
  TabPillLabel,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@shared/ui/components/primitives'

import { X } from 'lucide-react'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useRef
} from 'react'

/** A double-click within this window of activating a tab only selects it. */
const DOUBLE_CLICK_RENAME_GUARD_MS = 800

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
  /**
   * Time the tab was last activated by a click. A rapid second click on an
   * inactive tab is an activation gesture, not a rename: by the time
   * `dblclick` fires the component already re-rendered with `isActive=true`,
   * so an `isActive` check alone is too late.
   */
  const activatedAtRef = useRef(0)

  // Stable per-tab ref callback (memo-safe: identity depends only on the
  // stable `buttonRef` and the immutable `tab.id`).
  const handleButtonRef = useCallback(
    (el: HTMLButtonElement | null) => buttonRef?.(el, tab.id),
    [buttonRef, tab.id]
  )

  const handleActivate = useCallback(() => {
    if (!isActive) activatedAtRef.current = Date.now()
    onSetActiveTab(tab.id)
  }, [isActive, onSetActiveTab, tab.id])

  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const activatedAt = activatedAtRef.current
      activatedAtRef.current = 0
      if (activatedAt !== 0 && Date.now() - activatedAt < DOUBLE_CLICK_RENAME_GUARD_MS) return
      if (!isActive) return
      onBeginRename(tab)
    },
    [isActive, onBeginRename, tab]
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
      <TabPillLabel isActive={isActive} data-pdf-tab-label="">
        {label}
      </TabPillLabel>
    </>
  )

  // Long file names shrink within the measured capacity instead of pushing the
  // add/overflow controls out of the row.
  return (
    <div className="group relative min-w-0" data-pdf-tab="">
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
            className="text-ql-12 text-foreground h-auto w-full max-w-[200px] min-w-[6rem] border-none bg-transparent px-0 shadow-none"
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
              onClick={handleActivate}
              onDoubleClick={handleDoubleClick}
              onContextMenu={(event) => onOpenContextMenu(event, tab.id)}
              aria-label={label}
              withControls
            >
              {tabLabel}
            </TabPill>
          </TooltipTrigger>
          <TooltipContent side="top" avoidCollisions={false}>
            {label} — {tr('tab_rename_hint', 'Double-click to rename')}
          </TooltipContent>
        </Tooltip>
      )}

      {/* While renaming, the input owns the right side of the pill. The close
          button used to sit on top of it and swallowed clicks meant for the
          text field. */}
      {!isEditing && (
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
      )}
    </div>
  )
}

export default memo(PdfTabItem)
