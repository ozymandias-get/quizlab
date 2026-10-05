import { type RefObject, useEffect, useSyncExternalStore } from 'react'

interface UseDialogBehaviorOptions {
  isOpen: boolean
  onClose: () => void
  dialogRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Every dialog in the app funnels through this hook, which makes it the one
 * place that knows whether *any* modal is up.
 *
 * That matters because the embedded AI pages are main-process `WebContentsView`s:
 * they composite above every DOM layer, so a `fixed inset-0` modal would render
 * underneath them and be unclickable. Anything that has to sit above a managed
 * view reads {@link useIsAnyDialogOpen} and steps out of the way.
 */
let openDialogCount = 0
const openDialogListeners = new Set<() => void>()

function emitOpenDialogChange(): void {
  for (const listener of openDialogListeners) listener()
}

function subscribeOpenDialog(listener: () => void): () => void {
  openDialogListeners.add(listener)
  return () => {
    openDialogListeners.delete(listener)
  }
}

function getOpenDialogSnapshot(): boolean {
  return openDialogCount > 0
}

/** True while at least one dialog that follows the shared standard is open. */
export function useIsAnyDialogOpen(): boolean {
  return useSyncExternalStore(subscribeOpenDialog, getOpenDialogSnapshot, () => false)
}

// Shared modal behavior standard: body scroll lock, Escape-to-close, Tab focus
// trap, initial focus into the dialog and focus restore on close.
export function useDialogBehavior({
  isOpen,
  onClose,
  dialogRef,
  initialFocusRef
}: UseDialogBehaviorOptions) {
  useEffect(() => {
    if (!isOpen) return
    openDialogCount += 1
    emitOpenDialogChange()

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Focus trap: keep Tab/Shift+Tab cycling inside the dialog panel.
      if (e.key !== 'Tab') return
      const dialogEl = dialogRef.current
      if (!dialogEl) return
      const focusable = dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    // Move focus into the dialog (after layout settles).
    requestAnimationFrame(() => initialFocusRef?.current?.focus())
    return () => {
      openDialogCount = Math.max(0, openDialogCount - 1)
      emitOpenDialogChange()
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose, dialogRef, initialFocusRef])
}
