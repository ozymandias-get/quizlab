/**
 * Ctrl/Cmd + `-` / `=` / `0` zoom shortcuts for the PDF viewer.
 *
 * ## The binding this hook owns
 *
 * These three keys are bound here, not by the viewer. The key set (`-`, `=`, `0`),
 * the modifier (Cmd on macOS, Ctrl elsewhere), rejection of `shiftKey` /
 * `altKey`, a `document`-level listener, and — the important one —
 * `preventDefault()` **only** when the shortcut actually changes something, so an
 * unrelated default keeps working when the viewer is not in a state to handle it.
 *
 * ## Scope, and why there is no focus check
 *
 * There is deliberately no `containerRef.current.contains(document.activeElement)`
 * guard: QuizLab never moves DOM focus into the PDF surface — the shared viewer
 * container is not focusable and neither the canvas nor the text layer takes
 * focus — such a check would make the shortcuts unreachable, and the toolbar
 * advertises `+ / −`
 * unconditionally (`PdfZoomControls`, `common.json#zoom_hint`). Scope is
 * therefore expressed as: a PDF document is open and ready (`enabled`), and the
 * key was not pressed in a field that owns its own typing.
 *
 * The editable-target exclusion is the app's existing convention, not a new
 * idea: `FocusOverlay` already guards its Escape handler with the same
 * `closest('input, textarea, [contenteditable="true"]')` test. That is what keeps
 * this from stealing Ctrl/Cmd+`-` from the AI composer or the search box.
 */
import { isMacPlatform } from '@shared/lib/shortcutUtils'

import { useEffect, useRef } from 'react'

/**
 * Same rule the app already applies to its own Escape handling: a key pressed
 * inside a field that legitimately owns that character belongs to the field.
 */
const EDITABLE_TARGET_SELECTOR = 'input, textarea, [contenteditable="true"]'

interface UsePdfZoomShortcutsOptions {
  zoomIn: () => void
  zoomOut: () => void
  /** Back to the viewer's fit scale. No-op while the fit scale is unknown. */
  fit: () => void
  /** A PDF document is open and able to accept a zoom. */
  enabled: boolean
  /** Override for tests; defaults to real platform detection. */
  isMac?: boolean
}

export function usePdfZoomShortcuts({
  zoomIn,
  zoomOut,
  fit,
  enabled,
  isMac = isMacPlatform()
}: UsePdfZoomShortcutsOptions) {
  const zoomInRef = useRef(zoomIn)
  const zoomOutRef = useRef(zoomOut)
  const fitRef = useRef(fit)
  const enabledRef = useRef(enabled)
  zoomInRef.current = zoomIn
  zoomOutRef.current = zoomOut
  fitRef.current = fit
  enabledRef.current = enabled

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.shiftKey) return
      const isCommandPressed = isMac
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey
      if (!isCommandPressed) return
      if (!enabledRef.current) return

      const target = event.target
      if (
        target instanceof Element &&
        typeof target.closest === 'function' &&
        target.closest(EDITABLE_TARGET_SELECTOR)
      ) {
        return
      }

      // Assigned first so `preventDefault` below is reached only for a key this
      // hook consumes — an unrecognised Ctrl/Cmd combination is left alone.
      let action: (() => void) | null = null
      switch (event.key) {
        case '-':
          action = zoomOutRef.current
          break
        case '=':
          action = zoomInRef.current
          break
        case '0':
          action = fitRef.current
          break
        default:
          return
      }

      event.preventDefault()
      action()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMac])
}
