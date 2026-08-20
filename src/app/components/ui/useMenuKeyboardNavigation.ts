import { type RefObject, useCallback, useRef } from 'react'

interface UseMenuKeyboardNavigationOptions {
  onClose: () => void
}

/**
 * ARIA menu keyboard pattern for `role="menu"` containers. Returns a callback
 * ref to attach to the menu element (it also keeps `menuRef.current` in sync
 * for callers that use the ref for positioning / outside-click detection).
 *
 * - focuses the first enabled menuitem when the menu opens
 * - ArrowDown / ArrowUp cycle through enabled menuitems
 * - Home / End jump to the first / last enabled menuitem
 * - Escape closes the menu and returns focus to the opener
 * - when the menu element unmounts, focus is restored to the opener unless
 *   the user already moved focus somewhere else
 *
 * Mouse behavior is untouched; Enter / Space are handled natively by the
 * menuitem buttons.
 */
function useMenuKeyboardNavigation(
  menuRef: RefObject<HTMLDivElement | null>,
  { onClose }: UseMenuKeyboardNavigationOptions
): (element: HTMLDivElement | null) => void {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const openerRef = useRef<HTMLElement | null>(null)
  const attachedRef = useRef(false)

  return useCallback(
    (element: HTMLDivElement | null) => {
      menuRef.current = element

      if (element) {
        if (attachedRef.current) return
        attachedRef.current = true

        openerRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null

        const enabledItemSelector = '[role="menuitem"]:not([disabled])'
        const getItems = () => [...element.querySelectorAll<HTMLElement>(enabledItemSelector)]

        const restoreFocusToOpener = () => {
          const opener = openerRef.current
          if (opener && opener.isConnected) opener.focus()
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
            const opener = openerRef.current
            if (opener && opener.isConnected) opener.focus()
          }
        }, 0)
      }
    },
    [menuRef]
  )
}

export { useMenuKeyboardNavigation }
