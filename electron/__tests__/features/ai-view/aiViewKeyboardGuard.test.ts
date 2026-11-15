import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'

import {
  installChatGptShortcutGuard,
  isChatGptSidebarShortcut,
  isChatGptViewPartition
} from '../../../features/ai-view/aiViewKeyboardGuard.js'

type GuardListener = (event: { preventDefault: () => void }, input: unknown) => void

function fakeWebContents() {
  const listeners = new Set<GuardListener>()
  let destroyed = false
  return {
    on: vi.fn((event: string, handler: GuardListener) => {
      if (event === 'before-input-event') listeners.add(handler)
    }),
    removeListener: vi.fn((event: string, handler: GuardListener) => {
      if (event === 'before-input-event') listeners.delete(handler)
    }),
    isDestroyed: () => destroyed,
    destroy: () => {
      destroyed = true
      listeners.clear()
    },
    listenerCount: () => listeners.size,
    /** Delivers an input and reports whether the guard cancelled it. */
    dispatch: (input: unknown) => {
      const event = { preventDefault: vi.fn() }
      for (const listener of listeners) listener(event, input)
      return event.preventDefault
    }
  }
}

function keyDown(overrides: Record<string, unknown> = {}) {
  return {
    type: 'keyDown',
    key: 's',
    control: true,
    shift: true,
    alt: false,
    meta: false,
    ...overrides
  }
}

function asWebContents(fake: ReturnType<typeof fakeWebContents>): WebContents {
  return fake as unknown as WebContents
}

describe('isChatGptSidebarShortcut', () => {
  it('matches exactly Ctrl+Shift+S', () => {
    expect(isChatGptSidebarShortcut(keyDown())).toBe(true)
    // The key is compared case-insensitively: Caps Lock or a shifted layout
    // still reports the same binding the page listens for.
    expect(isChatGptSidebarShortcut(keyDown({ key: 'S' }))).toBe(true)
    expect(isChatGptSidebarShortcut(keyDown({ type: 'rawKeyDown' }))).toBe(true)
  })

  it('leaves every other combination to the page', () => {
    expect(isChatGptSidebarShortcut(keyDown({ control: false }))).toBe(false)
    expect(isChatGptSidebarShortcut(keyDown({ shift: false }))).toBe(false)
    expect(isChatGptSidebarShortcut(keyDown({ alt: true }))).toBe(false)
    expect(isChatGptSidebarShortcut(keyDown({ meta: true }))).toBe(false)
    expect(isChatGptSidebarShortcut(keyDown({ key: 'p' }))).toBe(false)
    expect(isChatGptSidebarShortcut(keyDown({ type: 'keyUp' }))).toBe(false)
    // Ctrl+C / Ctrl+Shift+V and friends must reach the composer untouched.
    expect(isChatGptSidebarShortcut(keyDown({ key: 'c', shift: false }))).toBe(false)
    expect(isChatGptSidebarShortcut(keyDown({ key: 'v' }))).toBe(false)
  })
})

describe('isChatGptViewPartition', () => {
  it('recognises only the ChatGPT partition from the registry', () => {
    expect(isChatGptViewPartition('persist:ai_chatgpt')).toBe(true)
    expect(isChatGptViewPartition('persist:ai_gemini')).toBe(false)
    expect(isChatGptViewPartition('persist:gemini_web_profile')).toBe(false)
  })
})

describe('installChatGptShortcutGuard', () => {
  it('cancels the sidebar chord on Windows and Linux', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const fake = fakeWebContents()
      installChatGptShortcutGuard(asWebContents(fake), platform)

      expect(fake.dispatch(keyDown())).toHaveBeenCalledTimes(1)
      expect(fake.listenerCount()).toBe(1)
    }
  })

  it('does not touch Cmd+Shift+S on macOS', () => {
    const fake = fakeWebContents()
    const dispose = installChatGptShortcutGuard(asWebContents(fake), 'darwin')

    expect(fake.on).not.toHaveBeenCalled()
    expect(fake.dispatch(keyDown({ meta: true, control: false }))).not.toHaveBeenCalled()

    expect(() => dispose()).not.toThrow()
  })

  it('passes every other chord through to ChatGPT', () => {
    const fake = fakeWebContents()
    installChatGptShortcutGuard(asWebContents(fake), 'linux')

    expect(fake.dispatch(keyDown({ key: 'c', shift: false }))).not.toHaveBeenCalled()
    expect(fake.dispatch(keyDown({ key: 'v', control: false }))).not.toHaveBeenCalled()
    expect(fake.dispatch(keyDown({ key: 'p' }))).not.toHaveBeenCalled()
    expect(fake.dispatch(keyDown({ key: 'i' }))).not.toHaveBeenCalled()
    expect(
      fake.dispatch({ type: 'keyUp', key: 's', control: true, shift: true })
    ).not.toHaveBeenCalled()
  })

  it('registers a single listener per WebContents', () => {
    const fake = fakeWebContents()
    const first = installChatGptShortcutGuard(asWebContents(fake), 'win32')
    const second = installChatGptShortcutGuard(asWebContents(fake), 'win32')

    expect(fake.on).toHaveBeenCalledTimes(1)
    expect(fake.listenerCount()).toBe(1)

    // Either handle disposes the one guard; the second call is a no-op.
    first()
    expect(fake.listenerCount()).toBe(0)
    expect(() => second()).not.toThrow()
  })

  it('can be installed again after a disposal', () => {
    const fake = fakeWebContents()
    const dispose = installChatGptShortcutGuard(asWebContents(fake), 'win32')
    dispose()

    installChatGptShortcutGuard(asWebContents(fake), 'win32')

    expect(fake.listenerCount()).toBe(1)
    expect(fake.dispatch(keyDown())).toHaveBeenCalledTimes(1)
  })

  it('disposes safely once the guest is gone', () => {
    const fake = fakeWebContents()
    const dispose = installChatGptShortcutGuard(asWebContents(fake), 'win32')
    fake.destroy()

    expect(() => dispose()).not.toThrow()
    expect(fake.removeListener).not.toHaveBeenCalled()
  })
})
