import type { Session, WebContents } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronState = vi.hoisted(() => {
  const state = {
    existingContents: [] as unknown[],
    finalUrl: 'https://gemini.google.com/app',
    loadResult: Promise.resolve(),
    browserWindowCreated: false,
    destroyedWindows: 0,
    loadedUrl: '',
    getAllWebContents: vi.fn(() => state.existingContents)
  }

  class MockBrowserWindow {
    readonly webContents = {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      getURL: vi.fn(() => state.finalUrl)
    }

    constructor(readonly options: unknown) {
      state.browserWindowCreated = true
    }

    loadURL(url: string): Promise<void> {
      state.loadedUrl = url
      return state.loadResult
    }

    isDestroyed(): boolean {
      return false
    }

    destroy(): void {
      state.destroyedWindows += 1
    }
  }

  return { state, MockBrowserWindow }
})

vi.mock('electron', () => ({
  BrowserWindow: electronState.MockBrowserWindow,
  webContents: {
    getAllWebContents: electronState.state.getAllWebContents
  }
}))

const { probePersistentSession } =
  await import('../../../features/gemini-web-session/sessionProbe.js')

function createSession(cookies: Electron.Cookie[]): Session {
  const session = Object.create(null) as Session
  Object.defineProperty(session, 'cookies', {
    value: {
      get: vi.fn(async () => cookies)
    }
  })
  return session
}

function createExistingContents(session: Session, url: string): WebContents {
  const listeners = new Map<string, Set<() => void>>()
  const contents = Object.create(null) as WebContents
  Object.defineProperties(contents, {
    session: { value: session },
    isDestroyed: { value: () => false },
    getURL: { value: () => url },
    reload: {
      value: vi.fn(() => {
        for (const listener of listeners.get('did-finish-load') ?? []) listener()
      })
    },
    on: {
      value: vi.fn((event: string, listener: () => void) => {
        const eventListeners = listeners.get(event) ?? new Set<() => void>()
        eventListeners.add(listener)
        listeners.set(event, eventListeners)
        return contents
      })
    },
    removeListener: {
      value: vi.fn((event: string, listener: () => void) => {
        listeners.get(event)?.delete(listener)
        return contents
      })
    }
  })
  return contents
}

describe('probePersistentSession', () => {
  beforeEach(() => {
    electronState.state.existingContents = []
    electronState.state.finalUrl = 'https://gemini.google.com/app'
    electronState.state.loadResult = Promise.resolve()
    electronState.state.browserWindowCreated = false
    electronState.state.destroyedWindows = 0
    electronState.state.loadedUrl = ''
    electronState.state.getAllWebContents.mockClear()
  })

  it('reloads an existing managed page and reads a refreshed account hash', async () => {
    const session = createSession([
      {
        name: '__Secure-1PSID',
        value: 'account-token',
        domain: '.google.com',
        path: '/',
        sameSite: 'unspecified'
      }
    ])
    const contents = createExistingContents(session, 'https://gemini.google.com/app')
    electronState.state.existingContents = [contents]

    const result = await probePersistentSession(session)

    expect(result.outcome).toEqual({ kind: 'authenticated', healthy: true })
    expect(result.accountHash).toHaveLength(16)
    expect(contents.reload).toHaveBeenCalledOnce()
    expect(electronState.state.browserWindowCreated).toBe(false)
  })

  it('uses a hidden probe window when no managed page exists', async () => {
    const session = createSession([
      {
        name: 'SID',
        value: 'account-token',
        domain: '.google.com',
        path: '/',
        sameSite: 'unspecified'
      }
    ])

    const result = await probePersistentSession(session)

    expect(electronState.state.browserWindowCreated).toBe(true)
    expect(electronState.state.loadedUrl).toBe('https://gemini.google.com/app')
    expect(electronState.state.destroyedWindows).toBe(1)
    expect(result.outcome.healthy).toBe(true)
  })

  it('classifies a Google login redirect as unauthenticated', async () => {
    const session = createSession([])
    electronState.state.finalUrl = 'https://accounts.google.com/v3/signin'

    const result = await probePersistentSession(session)

    expect(result.outcome).toEqual({ kind: 'login_redirect', healthy: false })
  })

  it('classifies a failed load as a network failure', async () => {
    const session = createSession([])
    electronState.state.loadResult = Promise.reject(new Error('offline'))

    const result = await probePersistentSession(session)

    expect(result.outcome).toEqual({ kind: 'network', healthy: false })
    expect(result.timedOut).toBe(false)
  })
})
