/**
 * Regression tests for the PDF viewer's Ctrl/Cmd + `-` / `=` / `0` zoom
 * shortcuts.
 *
 * These bindings used to be owned by `@react-pdf-viewer`'s
 * `zoomPlugin({ enableShortcuts: true })`, which injected a `ShortcutHandler`
 * into the viewer slot. Deleting the plugin deletes the binding, so the native
 * viewer owns it — and "we re-added a keydown listener" is not a property that
 * survives on its own, so the key set, the modifier rules, the scope and the
 * `preventDefault` discipline are pinned here.
 */
import { usePdfZoomShortcuts } from '@features/pdf/viewport/usePdfZoomShortcuts'

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePdfZoomShortcuts', () => {
  const zoomIn = vi.fn()
  const zoomOut = vi.fn()
  const fit = vi.fn()

  function setup(options: { enabled?: boolean; isMac?: boolean } = {}) {
    return renderHook(() =>
      usePdfZoomShortcuts({
        zoomIn,
        zoomOut,
        fit,
        enabled: options.enabled ?? true,
        isMac: options.isMac ?? false
      })
    )
  }

  /** RPV matched `event.key` exactly, so the tests dispatch real `key` values. */
  function key(keyValue: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ...init,
      key: keyValue
    })
    document.body.dispatchEvent(event)
    return event
  }

  const ctrl = { ctrlKey: true }
  const cmd = { metaKey: true }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('the three bindings', () => {
    it('zooms out on Ctrl + -', () => {
      setup()
      key('-', ctrl)
      expect(zoomOut).toHaveBeenCalledTimes(1)
      expect(zoomIn).not.toHaveBeenCalled()
      expect(fit).not.toHaveBeenCalled()
    })

    it('zooms in on Ctrl + =', () => {
      setup()
      key('=', ctrl)
      expect(zoomIn).toHaveBeenCalledTimes(1)
      expect(zoomOut).not.toHaveBeenCalled()
      expect(fit).not.toHaveBeenCalled()
    })

    it('resets to fit on Ctrl + 0', () => {
      setup()
      key('0', ctrl)
      expect(fit).toHaveBeenCalledTimes(1)
      expect(zoomIn).not.toHaveBeenCalled()
      expect(zoomOut).not.toHaveBeenCalled()
    })

    it('uses the Meta key on macOS', () => {
      setup({ isMac: true })
      key('=', cmd)
      key('-', cmd)
      key('0', cmd)
      expect(zoomIn).toHaveBeenCalledTimes(1)
      expect(zoomOut).toHaveBeenCalledTimes(1)
      expect(fit).toHaveBeenCalledTimes(1)
    })

    it('ignores the non-platform modifier', () => {
      // Mirrors `usePdfShortcuts`: macOS means Meta, elsewhere means Ctrl, and
      // Ctrl+Meta+- is not a PDF zoom on either platform. Each platform gets its
      // own mount so the two listeners cannot mask each other.
      const mac = setup({ isMac: true })
      key('=', ctrl)
      expect(zoomIn).not.toHaveBeenCalled()
      mac.unmount()

      const other = setup({ isMac: false })
      key('=', cmd)
      expect(zoomIn).not.toHaveBeenCalled()
      other.unmount()
    })
  })

  describe('what it must not consume', () => {
    it('ignores the bindings without a modifier', () => {
      setup()
      key('-')
      key('=')
      key('0')
      expect(zoomOut).not.toHaveBeenCalled()
      expect(zoomIn).not.toHaveBeenCalled()
      expect(fit).not.toHaveBeenCalled()
    })

    it('ignores shift and alt combinations', () => {
      setup()
      key('=', { ...ctrl, shiftKey: true })
      key('-', { ...ctrl, altKey: true })
      expect(zoomIn).not.toHaveBeenCalled()
      expect(zoomOut).not.toHaveBeenCalled()
    })

    it('ignores auto-repeat, matching `usePdfShortcuts`', () => {
      setup()
      key('=', { ...ctrl, repeat: true })
      expect(zoomIn).not.toHaveBeenCalled()
    })

    it('ignores other Ctrl combinations without preventing their default', () => {
      setup()
      const event = key('j', ctrl)
      expect(event.defaultPrevented).toBe(false)
      expect(zoomIn).not.toHaveBeenCalled()
      expect(zoomOut).not.toHaveBeenCalled()
      expect(fit).not.toHaveBeenCalled()
    })

    it('ignores everything while the viewer has no ready document', () => {
      setup({ enabled: false })
      key('=', ctrl)
      key('-', ctrl)
      key('0', ctrl)
      expect(zoomIn).not.toHaveBeenCalled()
      expect(zoomOut).not.toHaveBeenCalled()
      expect(fit).not.toHaveBeenCalled()
    })

    it('follows the latest enabled value without re-subscribing', () => {
      const { rerender } = renderHook(
        ({ on }: { on: boolean }) =>
          usePdfZoomShortcuts({ zoomIn, zoomOut, fit, enabled: on, isMac: false }),
        { initialProps: { on: false } }
      )

      key('=', ctrl)
      expect(zoomIn).not.toHaveBeenCalled()

      rerender({ on: true })
      key('=', ctrl)
      expect(zoomIn).toHaveBeenCalledTimes(1)
    })

    it('does not steal typing shortcuts from a text field', () => {
      // The project convention (see FocusOverlay's Escape guard): a key pressed in
      // a field that owns that character belongs to the field. Ctrl/Cmd+`-` inside
      // the AI composer or the search box is the user's typing, not a PDF zoom.
      setup()
      const input = document.createElement('input')
      const textarea = document.createElement('textarea')
      const editable = document.createElement('div')
      editable.setAttribute('contenteditable', 'true')
      document.body.append(input, textarea, editable)

      for (const field of [input, textarea, editable]) {
        const event = new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: '-'
        })
        field.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(false)
      }

      expect(zoomOut).not.toHaveBeenCalled()
    })

    it('still zooms from a non-field target', () => {
      setup()
      key('=', ctrl)
      expect(zoomIn).toHaveBeenCalledTimes(1)
    })
  })

  describe('preventDefault discipline', () => {
    it('prevents the default only for a key it handles', () => {
      setup()

      expect(key('=', ctrl).defaultPrevented).toBe(true)
      expect(key('-', ctrl).defaultPrevented).toBe(true)
      expect(key('0', ctrl).defaultPrevented).toBe(true)
      // An unhandled Ctrl combination keeps its default, so browser zoom and any
      // other Ctrl binding are untouched.
      expect(key('r', ctrl).defaultPrevented).toBe(false)
    })

    it('does not prevent the default while disabled', () => {
      setup({ enabled: false })
      expect(key('=', ctrl).defaultPrevented).toBe(false)
    })
  })

  it('removes its listener on unmount', () => {
    const { unmount } = setup()
    unmount()
    key('=', ctrl)
    expect(zoomIn).not.toHaveBeenCalled()
  })
})
