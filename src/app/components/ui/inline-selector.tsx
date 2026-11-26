import { cn } from '@shared/lib/uiUtils'

import * as React from 'react'
import { createPortal } from 'react-dom'

import { MenuSurface } from './menu'

interface InlineSelectorProps {
  open: boolean
  onClose: () => void
  closeLabel: string
  trigger: React.ReactNode
  popupClassName?: string
  children: React.ReactNode
}

interface PopupPosition {
  left: number
  top: number
  maxHeight: number
  ready: boolean
}

const VIEWPORT_MARGIN = 8
const MAX_POPUP_HEIGHT = 300
const FALLBACK_WIDTH = 240

/** Options are the keyboard stops; the container/trigger are not. */
const OPTION_SELECTOR = '[role="option"]:not([disabled]):not([aria-disabled="true"])'
const FOCUSABLE_TRIGGER_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function InlineSelector({
  open,
  onClose,
  closeLabel,
  trigger,
  popupClassName,
  children
}: InlineSelectorProps) {
  const anchorRef = React.useRef<HTMLSpanElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<PopupPosition>({
    left: VIEWPORT_MARGIN,
    top: VIEWPORT_MARGIN,
    maxHeight: MAX_POPUP_HEIGHT,
    ready: false
  })

  const restoreTriggerFocus = React.useCallback(() => {
    anchorRef.current?.querySelector<HTMLElement>(FOCUSABLE_TRIGGER_SELECTOR)?.focus()
  }, [])

  // A listbox is a keyboard widget, not a mouse-only menu: opening it moves
  // focus to the first option (the search field in ModelSelector already holds
  // focus, so there is nothing to move). Only run once the popup is visible;
  // before that it is `visibility: hidden` and focus() is a no-op.
  React.useEffect(() => {
    if (!open || !position.ready) return
    const menu = menuRef.current
    if (!menu || menu.contains(document.activeElement)) return
    const first =
      menu.querySelector<HTMLElement>(OPTION_SELECTOR) ??
      menu.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
      )
    first?.focus()
  }, [open, position.ready])

  // If focus was inside the popup when it closed (Escape, selection, click
  // outside), return it to the trigger instead of dropping it on the body.
  React.useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    return () => {
      const active = document.activeElement
      const focusWasInside =
        !active || active === document.body || !active.isConnected || !!menu?.contains(active)
      if (focusWasInside) restoreTriggerFocus()
    }
  }, [open, restoreTriggerFocus])

  const handleMenuKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // The ModelSelector search field owns Arrow/Enter/Escape while it is
      // focused; it marks those events handled.
      if (event.defaultPrevented) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Home' &&
        event.key !== 'End'
      ) {
        return
      }

      const menu = menuRef.current
      if (!menu) return
      const items = [...menu.querySelectorAll<HTMLElement>(OPTION_SELECTOR)]
      if (items.length === 0) return

      event.preventDefault()
      const currentIndex = items.indexOf(document.activeElement as HTMLElement)
      let nextIndex: number
      if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = items.length - 1
      } else if (event.key === 'ArrowDown') {
        nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1)
      } else {
        nextIndex = currentIndex < 0 ? items.length - 1 : Math.max(currentIndex - 1, 0)
      }
      items[nextIndex]?.focus()
    },
    [onClose]
  )

  // Portalled + fixed so a parent with `overflow-hidden` (the chat input card)
  // cannot clip the list, and so the list can flip above/below the trigger
  // based on the real available viewport space.
  const updatePosition = React.useCallback(() => {
    const anchor = anchorRef.current
    const menu = menuRef.current
    if (!anchor || !menu || window.innerHeight <= 0) return

    const rect = anchor.getBoundingClientRect()
    const menuWidth = menu.offsetWidth || FALLBACK_WIDTH
    const desiredHeight = Math.min(menu.scrollHeight || MAX_POPUP_HEIGHT, MAX_POPUP_HEIGHT)

    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN
    const spaceAbove = rect.top - VIEWPORT_MARGIN
    const openDown = spaceBelow >= desiredHeight || spaceBelow >= spaceAbove
    // Use the viewport itself when the trigger leaves no room on either side
    // (a very short window). A zero height would make the menu invisible; the
    // content scrolls inside the capped surface instead.
    const sideAvailable = Math.max(0, openDown ? spaceBelow : spaceAbove)
    const viewportAvailable = Math.max(0, window.innerHeight - 2 * VIEWPORT_MARGIN)
    const available = sideAvailable > 0 ? sideAvailable : viewportAvailable
    const menuHeight = Math.min(desiredHeight, available)

    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - menuWidth - VIEWPORT_MARGIN)
    const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), maxLeft)
    const top =
      sideAvailable > 0
        ? openDown
          ? rect.bottom + VIEWPORT_MARGIN
          : Math.max(VIEWPORT_MARGIN, rect.top - menuHeight - VIEWPORT_MARGIN)
        : VIEWPORT_MARGIN

    setPosition({
      left,
      top,
      maxHeight: Math.min(MAX_POPUP_HEIGHT, available),
      ready: true
    })
  }, [])

  React.useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  // The menu is fixed to the viewport, so it must follow the window while open.
  // Scrolling any ancestor and the trigger resizing can move the anchor too.
  React.useEffect(() => {
    if (!open) {
      setPosition((previous) => ({ ...previous, ready: false }))
      return
    }

    const handleReposition = () => updatePosition()
    const visualViewport = window.visualViewport

    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    visualViewport?.addEventListener('resize', handleReposition)
    visualViewport?.addEventListener('scroll', handleReposition)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && anchorRef.current) {
      observer = new ResizeObserver(handleReposition)
      observer.observe(anchorRef.current)
    }

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
      visualViewport?.removeEventListener('resize', handleReposition)
      visualViewport?.removeEventListener('scroll', handleReposition)
      observer?.disconnect()
    }
  }, [open, updatePosition])

  return (
    <>
      <span ref={anchorRef} className="inline-flex max-w-full">
        {trigger}
      </span>
      {open &&
        createPortal(
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-label={closeLabel}
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => {
                onClose()
                // A tabindex=-1 button can take focus on click; the overlay
                // unmounts immediately after, so hand focus back to the trigger.
                restoreTriggerFocus()
              }}
            />
            <MenuSurface
              ref={menuRef}
              role={null}
              onKeyDown={handleMenuKeyDown}
              className={cn(
                'animate-in fade-in zoom-in-98 motion-normal fixed flex flex-col overflow-y-auto p-1.5',
                popupClassName
              )}
              style={{
                left: position.left,
                top: position.top,
                maxHeight: position.maxHeight,
                visibility: position.ready ? 'visible' : 'hidden'
              }}
            >
              {children}
            </MenuSurface>
          </>,
          document.body
        )}
    </>
  )
}

export { InlineSelector }
