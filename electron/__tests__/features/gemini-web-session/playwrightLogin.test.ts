import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const playwrightMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  launchPersistentContext: vi.fn()
}))

vi.mock('fs', () => ({
  default: {
    existsSync: playwrightMocks.existsSync
  },
  existsSync: playwrightMocks.existsSync
}))

vi.mock('playwright-core', () => ({
  chromium: {
    launchPersistentContext: playwrightMocks.launchPersistentContext
  }
}))

type CookieState = {
  name: string
  value: string
  domain: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  expires?: number
}

type SnapshotState = {
  hasLoginForm: boolean
  hasComposer?: boolean
  hasChallengeText: boolean
  hasSignInText: boolean
}

function createPersistentContext(options?: {
  loopStates?: Array<{ url: string; snapshot: SnapshotState; cookies: CookieState[] }>
  hydrationState?: { snapshot: SnapshotState; cookies: CookieState[] }
  pagesSequence?: any[][]
  newPageFailures?: number
}) {
  const loopStates = options?.loopStates || []
  const hydrationState = options?.hydrationState || {
    snapshot: {
      hasLoginForm: false,
      hasComposer: true,
      hasChallengeText: false,
      hasSignInText: false
    },
    cookies: loopStates.length > 0 ? loopStates[loopStates.length - 1].cookies : []
  }
  let activeState = loopStates[0] || {
    url: 'https://accounts.google.com/ServiceLogin',
    snapshot: {
      hasLoginForm: true,
      hasChallengeText: false,
      hasSignInText: true
    },
    cookies: []
  }
  let currentUrl = activeState.url
  let loopIndex = 0
  let inHydration = false
  let remainingNewPageFailures = options?.newPageFailures || 0

  const page = {
    goto: vi.fn(async (url: string) => {
      currentUrl = url
      const matchingLoopState = loopStates.find((state) => state.url === url)
      if (matchingLoopState) {
        inHydration = false
        activeState = matchingLoopState
        return
      }
      if (url.includes('ServiceLogin')) {
        inHydration = false
        activeState = loopStates[0] || activeState
        return
      }
      inHydration = true
    }),
    url: vi.fn(() => {
      if (!inHydration) {
        activeState = loopStates[Math.min(loopIndex, loopStates.length - 1)] || activeState
        currentUrl = activeState.url
        loopIndex += 1
      }
      return currentUrl
    }),
    evaluate: vi.fn(async () => (inHydration ? hydrationState.snapshot : activeState.snapshot)),
    waitForLoadState: vi.fn(async () => undefined),
    isClosed: vi.fn(() => false)
  }

  let pagesCallCount = 0
  const context = {
    pages: vi.fn(() => {
      const sequence = options?.pagesSequence
      if (sequence && pagesCallCount < sequence.length) {
        const result = sequence[pagesCallCount]
        pagesCallCount += 1
        return result
      }
      pagesCallCount += 1
      return [page]
    }),
    newPage: vi.fn(async () => {
      if (remainingNewPageFailures > 0) {
        remainingNewPageFailures -= 1
        throw new Error('new page failed')
      }
      return page
    }),
    cookies: vi.fn(async () => (inHydration ? hydrationState.cookies : activeState.cookies)),
    setDefaultTimeout: vi.fn(),
    setDefaultNavigationTimeout: vi.fn(),
    close: vi.fn(async () => undefined)
  }

  return { context, page }
}

describe('playwrightLogin', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    playwrightMocks.existsSync.mockReset().mockReturnValue(true)
    playwrightMocks.launchPersistentContext.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns error_browser_not_found when no supported system browser exists', async () => {
    playwrightMocks.existsSync.mockReturnValue(false)
    const { runPlaywrightLogin } =
      await import('../../../features/gemini-web-session/playwrightLogin.js')

    const result = await runPlaywrightLogin({
      profileDir: 'C:/tmp/pw',
      timeoutMs: 5_000
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('error_browser_not_found')
  })

  it('creates a fallback page when all tabs are closed and still completes login', async () => {
    const sidCookie = {
      name: 'SID',
      value: 'session-cookie',
      domain: '.google.com',
      secure: true,
      httpOnly: true
    }
    const { context } = createPersistentContext({
      loopStates: [
        {
          url: 'https://myaccount.google.com/',
          snapshot: {
            hasLoginForm: false,
            hasComposer: false,
            hasChallengeText: false,
            hasSignInText: false
          },
          cookies: [sidCookie]
        }
      ],
      hydrationState: {
        snapshot: {
          hasLoginForm: false,
          hasComposer: true,
          hasChallengeText: false,
          hasSignInText: false
        },
        cookies: [sidCookie]
      },
      pagesSequence: [[], []]
    })
    playwrightMocks.launchPersistentContext.mockResolvedValue(context)
    vi.spyOn(Date, 'now').mockReturnValue(0)
    const { runPlaywrightLogin } =
      await import('../../../features/gemini-web-session/playwrightLogin.js')

    const resultPromise = runPlaywrightLogin({
      profileDir: 'C:/tmp/pw',
      timeoutMs: 5_000
    })
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(context.newPage).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
    expect(result.accountHash).toBeTruthy()
  })

  it('completes login after leaving accounts.google.com with a valid Google session cookie', async () => {
    const sidCookie = {
      name: 'SID',
      value: 'session-cookie',
      domain: '.google.com',
      secure: true,
      httpOnly: true
    }
    const { context } = createPersistentContext({
      loopStates: [
        {
          url: 'https://accounts.google.com/v3/signin/challenge/pwd',
          snapshot: {
            hasLoginForm: false,
            hasComposer: false,
            hasChallengeText: false,
            hasSignInText: true
          },
          cookies: []
        },
        {
          url: 'https://gemini.google.com/app',
          snapshot: {
            hasLoginForm: false,
            hasComposer: true,
            hasChallengeText: false,
            hasSignInText: false
          },
          cookies: [sidCookie]
        }
      ],
      hydrationState: {
        snapshot: {
          hasLoginForm: false,
          hasComposer: true,
          hasChallengeText: false,
          hasSignInText: false
        },
        cookies: [sidCookie]
      }
    })
    playwrightMocks.launchPersistentContext.mockResolvedValue(context)
    vi.spyOn(Date, 'now').mockReturnValue(0)
    const { runPlaywrightLogin } =
      await import('../../../features/gemini-web-session/playwrightLogin.js')

    const resultPromise = runPlaywrightLogin({
      profileDir: 'C:/tmp/pw',
      timeoutMs: 5_000
    })
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(true)
    expect(result.accountHash).toBeTruthy()
    expect(result.cookies).toHaveLength(1)
  })

  it('returns error_challenge_required when Google presents an account challenge', async () => {
    const { context } = createPersistentContext({
      loopStates: [
        {
          url: 'https://accounts.google.com/signin/v2/challenge/selection',
          snapshot: {
            hasLoginForm: false,
            hasComposer: false,
            hasChallengeText: true,
            hasSignInText: false
          },
          cookies: []
        }
      ]
    })
    playwrightMocks.launchPersistentContext.mockResolvedValue(context)
    vi.spyOn(Date, 'now').mockReturnValue(0)
    const { runPlaywrightLogin } =
      await import('../../../features/gemini-web-session/playwrightLogin.js')

    const result = await runPlaywrightLogin({
      profileDir: 'C:/tmp/pw',
      timeoutMs: 5_000
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('error_challenge_required')
  })

  it('returns error_login_timeout when login does not complete before the timeout', async () => {
    const { context } = createPersistentContext({
      loopStates: [
        {
          url: 'https://accounts.google.com/ServiceLogin',
          snapshot: {
            hasLoginForm: true,
            hasComposer: false,
            hasChallengeText: false,
            hasSignInText: true
          },
          cookies: []
        }
      ]
    })
    playwrightMocks.launchPersistentContext.mockResolvedValue(context)
    vi.setSystemTime(new Date('2026-04-08T00:00:00.000Z'))
    const { runPlaywrightLogin } =
      await import('../../../features/gemini-web-session/playwrightLogin.js')

    const resultPromise = runPlaywrightLogin({
      profileDir: 'C:/tmp/pw',
      timeoutMs: 1_000
    })
    await vi.advanceTimersByTimeAsync(1_600)
    const result = await resultPromise

    expect(result.success).toBe(false)
    expect(result.error).toBe('error_login_timeout')
    expect(result.timedOut).toBe(true)
  })

  it('falls back to pre-hydration cookies only when hydration exhausts its timeout budget', async () => {
    const sidCookie = {
      name: 'SID',
      value: 'session-cookie',
      domain: '.google.com',
      secure: true,
      httpOnly: true
    }
    const { context } = createPersistentContext({
      loopStates: [
        {
          url: 'https://gemini.google.com/app',
          snapshot: {
            hasLoginForm: false,
            hasComposer: true,
            hasChallengeText: false,
            hasSignInText: false
          },
          cookies: [sidCookie]
        }
      ],
      hydrationState: {
        snapshot: {
          hasLoginForm: false,
          hasComposer: false,
          hasChallengeText: false,
          hasSignInText: false
        },
        cookies: []
      }
    })
    playwrightMocks.launchPersistentContext.mockResolvedValue(context)
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 0)
      .mockImplementation(() => 2_000)
    const { runPlaywrightHeadlessRefresh } =
      await import('../../../features/gemini-web-session/playwrightLogin.js')

    const result = await runPlaywrightHeadlessRefresh({
      profileDir: 'C:/tmp/pw',
      timeoutMs: 1_000
    })

    expect(result.success).toBe(true)
    expect(result.cookies).toHaveLength(1)
    expect(result.accountHash).toBeTruthy()
    nowSpy.mockRestore()
  })
})
