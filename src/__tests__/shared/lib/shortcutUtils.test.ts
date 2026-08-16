import { getShortcutModifierLabel, isMacPlatform } from '@shared/lib/shortcutUtils'

import { afterEach, describe, expect, it, vi } from 'vitest'

describe('isMacPlatform', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as { electronAPI?: unknown }).electronAPI
  })

  it('returns false by default (non-mac user agent, no electron API)', () => {
    expect(isMacPlatform()).toBe(false)
    expect(getShortcutModifierLabel()).toBe('Ctrl')
  })

  it('detects macOS from the user agent in browser environments', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })

    expect(isMacPlatform()).toBe(true)
    expect(getShortcutModifierLabel()).toBe('⌘')
  })

  it('prefers the Electron main-process platform over the user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { platform: 'win32' }
    })

    expect(isMacPlatform()).toBe(false)
    expect(getShortcutModifierLabel()).toBe('Ctrl')
  })

  it('detects darwin from the Electron platform field', () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { platform: 'darwin' }
    })

    expect(isMacPlatform()).toBe(true)
    expect(getShortcutModifierLabel()).toBe('⌘')
  })

  it('is safe when navigator is unavailable', () => {
    vi.stubGlobal('navigator', undefined)

    expect(isMacPlatform()).toBe(false)
  })
})
