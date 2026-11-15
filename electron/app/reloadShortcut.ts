/**
 * The keyboard shortcuts that reload the renderer.
 *
 * Reloading destroys the renderer before `beforeunload` can await an
 * IndexedDB write, so the main process owns these shortcuts and runs the same
 * flush handshake as the close path. Kept as a pure predicate so the binding
 * can be tested without an Electron window.
 */
export interface ReloadShortcutInput {
  type: string
  key: string
  control: boolean
  meta: boolean
}

export function isReloadShortcut(input: ReloadShortcutInput): boolean {
  if (input.type !== 'keyDown') return false
  if (input.key === 'F5') return true
  return (input.control || input.meta) && input.key.toLowerCase() === 'r'
}
