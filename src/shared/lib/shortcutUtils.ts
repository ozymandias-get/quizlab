import { getElectronApi, hasElectronApi } from './electronApi'

/**
 * True when the app runs on macOS (Cmd/Ctrl modifier abstraction).
 * Prefers the platform exposed by the Electron main process, falls back to
 * the user agent for browser-based development / tests.
 */
export function isMacPlatform(): boolean {
  const api = getElectronApi()
  if (hasElectronApi() && api) {
    return api.platform === 'darwin'
  }
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/i.test(navigator.userAgent)
}

/** Renders the modifier prefix used in shortcut badges (⌘ on macOS, Ctrl elsewhere). */
export function getShortcutModifierLabel(): '⌘' | 'Ctrl' {
  return isMacPlatform() ? '⌘' : 'Ctrl'
}
