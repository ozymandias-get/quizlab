import type { RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

let globalScrollLockCount = 0
let globalScrollLockOriginal: string | null = null

export function useDialogAccessibility(
  dialogRef: RefObject<HTMLDivElement>,
  isVisible: boolean,
  loading: boolean,
  onClose: () => void
) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const restoreFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (!isVisible) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    if (globalScrollLockCount === 0) {
      globalScrollLockOriginal = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    globalScrollLockCount += 1

    const focusFrame = requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog) return
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]):not([hidden]):not([inert]), [href]:not([disabled]):not([hidden]):not([inert]), input:not([disabled]):not([hidden]):not([inert]), select:not([disabled]):not([hidden]):not([inert]), textarea:not([disabled]):not([hidden]):not([inert]), [tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden]):not([inert])'
      )
      ;(firstFocusable ?? dialog).focus()
    })

    return () => {
      cancelAnimationFrame(focusFrame)

      globalScrollLockCount -= 1
      if (globalScrollLockCount <= 0) {
        document.body.style.overflow = globalScrollLockOriginal ?? ''
        globalScrollLockOriginal = null
      }

      if (restoreFocusTimeoutRef.current !== null) {
        clearTimeout(restoreFocusTimeoutRef.current)
      }

      const prevFocus = previouslyFocusedRef.current
      if (prevFocus) {
        restoreFocusTimeoutRef.current = setTimeout(() => {
          try {
            if (document.body.contains(prevFocus)) {
              prevFocus.focus?.()
            }
          } catch {
            // Silently ignore focus on detached element
          }
        }, 250)
      }
    }
  }, [isVisible, dialogRef])

  const handleKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!loading) {
          onClose()
        }
        return
      }

      if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusables = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]):not([hidden]):not([inert]), [href]:not([disabled]):not([hidden]):not([inert]), input:not([disabled]):not([hidden]):not([inert]), select:not([disabled]):not([hidden]):not([inert]), textarea:not([disabled]):not([hidden]):not([inert]), [tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden]):not([inert])'
          )
        ].filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0)
        if (focusables.length === 0) {
          event.preventDefault()
          dialog.focus()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    },
    [loading, onClose, dialogRef]
  )

  useEffect(() => {
    if (!isVisible) return
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, isVisible])
}
