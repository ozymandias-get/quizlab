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
    // No artificial minimum: in a very short window a 96px floor would push the
    // panel past the edge again. Zero available space simply stays on-screen.
    const available = Math.max(0, openDown ? spaceBelow : spaceAbove)
    const menuHeight = Math.min(desiredHeight, available)

    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - menuWidth - VIEWPORT_MARGIN)
    const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), maxLeft)
    const top = openDown
      ? rect.bottom + VIEWPORT_MARGIN
      : Math.max(VIEWPORT_MARGIN, rect.top - menuHeight - VIEWPORT_MARGIN)

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
              onClick={onClose}
            />
            <MenuSurface
              ref={menuRef}
              role={null}
              className={cn(
                'animate-in fade-in zoom-in-98 motion-normal fixed flex flex-col p-1.5',
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
