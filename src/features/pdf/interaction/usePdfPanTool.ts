/**
 * Pointer-drag panning when `isPanMode` is on: scrolls the nearest scrollable
 * ancestor (the native viewer's page viewport) or falls back to the viewer's
 * viewport element, whose selector lives in `../native/nativePdfDom`.
 *
 * The hand tool is not the only way in. Holding Space while the pointer rests
 * on the page pans temporarily and returns to text selection on release, and
 * Escape leaves the persistent hand tool. Both live here because they are the
 * same gesture — "the page follows the pointer" — and because the drag effect
 * must see one combined "pan is engaged" flag rather than two independent ones.
 */
import { useIsAnyDialogOpen } from '@shared/hooks'
import { reportSuppressedError } from '@shared/lib/logger'

import { type RefObject, useEffect, useRef, useState } from 'react'

import { getInnerContainerFallback, getScrollableAncestor } from './panHelpers'

interface UsePdfPanToolOptions {
  containerRef: RefObject<HTMLElement | null>
  isPanMode: boolean
  /** Called when Escape asks to leave the persistent hand tool. */
  onExitPanMode?: () => void
}

/**
 * Space belongs to whatever the user is typing into. Buttons and links are
 * deliberately *not* listed: Space is their activation key too, so the space
 * pan only engages when focus is not on an interactive control either.
 */
const EDITABLE_TARGETS =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"], [role="combobox"]'

const NON_PAN_KEY_TARGETS = `${EDITABLE_TARGETS}, button, a[href], summary, [role="menuitem"], [role="button"]`

function isInteractiveTarget(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null
}

function isSpaceKey(event: KeyboardEvent): boolean {
  return event.code === 'Space' || event.key === ' '
}

/** `display: none` ancestors leave the box with no client rects. */
function isElementVisible(el: HTMLElement | null): boolean {
  return !!el && el.isConnected && el.getClientRects().length > 0
}

export function usePdfPanTool({ containerRef, isPanMode, onExitPanMode }: UsePdfPanToolOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const [isSpacePanActive, setIsSpacePanActive] = useState(false)
  const scrollElRef = useRef<HTMLElement | null>(null)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const pointerInsideRef = useRef(false)

  const isPanActive = isPanMode || isSpacePanActive
  const isAnyDialogOpen = useIsAnyDialogOpen()

  // Space is only a *temporary* hand tool while the pointer is on the page.
  // Without this guard a reader holding Space to scroll some other panel would
  // silently stop scrolling and start panning an off-screen PDF.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const handlePointerEnter = () => {
      pointerInsideRef.current = true
    }
    const handlePointerLeave = () => {
      pointerInsideRef.current = false
    }

    root.addEventListener('pointerenter', handlePointerEnter)
    root.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      root.removeEventListener('pointerenter', handlePointerEnter)
      root.removeEventListener('pointerleave', handlePointerLeave)
      pointerInsideRef.current = false
    }
  }, [containerRef])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSpaceKey(event) || event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      // A modal owns the keyboard while it is open; nothing behind it may pan.
      if (isAnyDialogOpen) return
      if (isInteractiveTarget(event.target, EDITABLE_TARGETS)) return

      if (!pointerInsideRef.current) {
        // Keyboard-only path: a focused control keeps Space as its activation
        // key. When the pointer rests on the page, panning wins instead — the
        // hand tool's toolbar button keeps focus after a click, and Space must
        // not re-activate it (or any other control) instead of panning.
        if (isInteractiveTarget(event.target, NON_PAN_KEY_TARGETS)) return
        if (!root.contains(document.activeElement)) return
      }

      // Holding Space would otherwise scroll the surrounding page while the
      // pointer is parked on the PDF.
      event.preventDefault()
      setIsSpacePanActive(true)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isSpaceKey(event)) return
      setIsSpacePanActive(false)
    }

    // A lost window means no keyup will arrive; never leave the page in a mode
    // the user cannot see a way out of.
    const handleWindowBlur = () => setIsSpacePanActive(false)

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
      setIsSpacePanActive(false)
    }
  }, [containerRef, isAnyDialogOpen])

  useEffect(() => {
    if (!isPanMode || !onExitPanMode) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // A modal owns Escape; exiting pan mode behind it would swallow the
      // dialog's close key.
      if (isAnyDialogOpen) return
      // Escape does not activate buttons, so a focused hand-tool button must
      // still be able to leave the mode. Only a text field keeps the key.
      if (isInteractiveTarget(event.target, EDITABLE_TARGETS)) return

      onExitPanMode()

      // Escape belongs to the visible hand tool first. Stopping the event here
      // keeps one press from also closing a focus overlay or another
      // document-level Escape handler. A hidden viewer (display: none) must not
      // swallow the key, so only a visible container claims it.
      if (isElementVisible(containerRef.current)) event.stopPropagation()
    }

    // Capture phase: the viewer's own layers and the surrounding shell both
    // listen for Escape on `document`, and the mode change has to win.
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [containerRef, isAnyDialogOpen, isPanMode, onExitPanMode])

  useEffect(() => {
    const root = containerRef.current
    if (!root || !isPanActive) return

    const cleanupDrag = () => {
      scrollElRef.current = null
      lastRef.current = null
      setIsDragging(false)
    }

    const handlePointerMove = (e: PointerEvent) => {
      const scrollEl = scrollElRef.current
      const last = lastRef.current
      if (!scrollEl || !last) return

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      lastRef.current = { x: e.clientX, y: e.clientY }
      scrollEl.scrollLeft -= dx
      scrollEl.scrollTop -= dy
    }

    const handlePointerUp = (e: PointerEvent) => {
      const scrollEl = scrollElRef.current
      if (scrollEl && typeof scrollEl.releasePointerCapture === 'function') {
        try {
          scrollEl.releasePointerCapture(e.pointerId)
        } catch (err) {
          reportSuppressedError('pdf.pan.releasePointerCapture', { cause: err })
        }
      }
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
      cleanupDrag()
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (!root.contains(e.target as Node)) return

      const target = e.target as Element
      let scrollHost = getScrollableAncestor(target, root)
      if (!scrollHost) {
        scrollHost = getInnerContainerFallback(root)
      }
      if (!scrollHost) return

      e.preventDefault()
      scrollElRef.current = scrollHost
      lastRef.current = { x: e.clientX, y: e.clientY }
      setIsDragging(true)

      try {
        scrollHost.setPointerCapture(e.pointerId)
      } catch (err) {
        reportSuppressedError('pdf.pan.setPointerCapture', { cause: err })
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
      document.addEventListener('pointercancel', handlePointerUp)
    }

    root.addEventListener('pointerdown', handlePointerDown)
    return () => {
      root.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
      cleanupDrag()
    }
  }, [containerRef, isPanActive])

  return { isDragging, isSpacePanActive }
}
