import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react'

interface UseDialogBehaviorOptions {
  isOpen: boolean
  onClose: () => void
  dialogRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

/**
 * Focusable elements that the user can actually reach right now.
 *
 * `querySelectorAll` alone also returns nodes hidden with `display:none`
 * (the settings modal keeps inactive tabs mounted this way), inside an
 * `inert` subtree, or clipped out of the layout — trapping Tab on one of
 * those would look like the focus ring vanished.
 */
function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => {
    if (element.closest('[inert]')) return false
    if (element.hidden) return false
    if (element.getAttribute('aria-hidden') === 'true') return false
    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    // Zero client rects means clipped/`display:contents`-like; jsdom has no
    // layout at all, so only enforce this when the document actually lays out.
    const documentHasLayout = document.documentElement.getClientRects().length > 0
    return !documentHasLayout || element.getClientRects().length > 0
  })
}

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
const openDialogs: symbol[] = []
let originalBodyOverflow = ''
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
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const initialFocusRefRef = useRef(initialFocusRef)
  initialFocusRefRef.current = initialFocusRef
  useEffect(() => {
    if (!isOpen) return
    const token = Symbol('dialog')
    openDialogs.push(token)
    if (openDialogCount === 0) originalBodyOverflow = document.body.style.overflow
    openDialogCount += 1
    emitOpenDialogChange()

    document.body.style.overflow = 'hidden'
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (openDialogs.at(-1) !== token || e.defaultPrevented) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      // Focus trap: keep Tab/Shift+Tab cycling inside the dialog panel.
      if (e.key !== 'Tab') return
      const dialogEl = dialogRef.current
      if (!dialogEl) return
      const focusable = getFocusableElements(dialogEl)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!dialogEl.contains(document.activeElement)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    // Move focus into the dialog (after layout settles).
    const focusFrame = requestAnimationFrame(() => {
      if (openDialogs.at(-1) !== token) return
      const dialogEl = dialogRef.current
      const target =
        initialFocusRefRef.current?.current ??
        (dialogEl ? getFocusableElements(dialogEl)[0] : undefined)
      target?.focus()
    })
    return () => {
      cancelAnimationFrame(focusFrame)
      const wasTopmost = openDialogs.at(-1) === token
      const index = openDialogs.indexOf(token)
      if (index !== -1) openDialogs.splice(index, 1)
      openDialogCount = Math.max(0, openDialogCount - 1)
      emitOpenDialogChange()
      if (openDialogCount === 0) document.body.style.overflow = originalBodyOverflow
      window.removeEventListener('keydown', handleKeyDown, true)
      if (wasTopmost && previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [isOpen, dialogRef])
}
