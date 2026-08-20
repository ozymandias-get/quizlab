import { type RefObject, useCallback, useRef } from 'react'

interface UseMenuKeyboardNavigationOptions {
  onClose: () => void
  /**
   * Optional element that should receive focus back when the menu closes
   * (e.g. the element that was right-clicked to open a context menu). When
   * provided, it takes precedence over the element that was focused when the
   * menu opened — that element remains the fallback.
   */
  triggerRef?: RefObject<HTMLElement | null>
}

/**
 * Elements that can actually receive focus, used to resolve a safe focus
 * restoration target (the trigger may be a non-focusable wrapper, in which
 * case its first focusable descendant is used).
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

/**
 * ARIA menu keyboard pattern for `role="menu"` containers. Returns a callback
 * ref to attach to the menu element (it also keeps `menuRef.current` in sync
 * for callers that use the ref for positioning / outside-click detection).
 *
 * - focuses the first enabled menuitem when the menu opens
 * - ArrowDown / ArrowUp navigate through enabled menuitems (no wrap-around:
 *   ArrowDown stays on the last item, ArrowUp stays on the first)
 * - Home / End jump to the first / last enabled menuitem
 * - Escape closes the menu and returns focus to the trigger element, or to
 *   the previously focused element when no trigger was provided
 * - when the menu element unmounts, focus is restored to the trigger unless
 *   the user already moved focus somewhere else
 *
 * Mouse behavior is untouched; Enter / Space are handled natively by the
 * menuitem buttons.
 */
function useMenuKeyboardNavigation(
  menuRef: RefObject<HTMLDivElement | null>,
  { onClose, triggerRef }: UseMenuKeyboardNavigationOptions
): (element: HTMLDivElement | null) => void {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const openerRef = useRef<HTMLElement | null>(null)
  const attachedRef = useRef(false)

  return useCallback(
    (element: HTMLDivElement | null) => {
      menuRef.current = element

      const getRestoreTarget = (): HTMLElement | null => {
        const trigger = triggerRef?.current
        if (trigger && trigger.isConnected) {
          if (trigger.matches(FOCUSABLE_SELECTOR)) return trigger
          const focusableDescendant = trigger.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
          if (focusableDescendant) return focusableDescendant
        }
        const opener = openerRef.current
        return opener && opener.isConnected ? opener : null
      }

      if (element) {
        if (attachedRef.current) return
        attachedRef.current = true

        openerRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null

        const enabledItemSelector = '[role="menuitem"]:not([disabled])'
        const getItems = () => [...element.querySelectorAll<HTMLElement>(enabledItemSelector)]

        const restoreFocusToOpener = () => {
          getRestoreTarget()?.focus()
        }

        const focusItemAt = (index: number) => {
          getItems()[index]?.focus()
        }

        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCloseRef.current()
            restoreFocusToOpener()
            return
          }

          const items = getItems()
          if (items.length === 0) return

          const currentIndex = items.indexOf(document.activeElement as HTMLElement)

          let nextIndex = currentIndex
          switch (event.key) {
            case 'ArrowDown':
              nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, items.length - 1)
              break
            case 'ArrowUp':
              nextIndex = currentIndex === -1 ? items.length - 1 : Math.max(currentIndex - 1, 0)
              break
            case 'Home':
              nextIndex = 0
              break
            case 'End':
              nextIndex = items.length - 1
              break
            default:
              return
          }

          event.preventDefault()
          focusItemAt(nextIndex)
        }

        element.addEventListener('keydown', handleKeyDown)
        getItems()[0]?.focus()
      } else if (attachedRef.current) {
        attachedRef.current = false

        // React 19 detaches the ref before removing the node from the DOM, so
        // a removed menuitem still reports as the connected active element
        // here. Defer the check one tick so focus has fallen back to the body
        // (or onto the element the user actually clicked) before deciding.
        window.setTimeout(() => {
          const active = document.activeElement
          const focusWasLost = !active || active === document.body || !active.isConnected

          if (focusWasLost) {
            getRestoreTarget()?.focus()
          }
        }, 0)
      }
    },
    [menuRef, triggerRef]
  )
}

export { useMenuKeyboardNavigation }
