/**
 * Extension service worker selector transfer lifecycle tests.
 *
 * Runs the real `background.js` in a `vm` sandbox against fake Chrome APIs and
 * a fake selector bridge to verify session state transitions, request-id
 * binding across retries/restarts, and payload data minimization.
 */
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SOURCE = readFileSync('extensions/quizlab-session-extension/background.js', 'utf8')
const SECRET = 'a'.repeat(64)
const PROFILE_ID = 'profile-selector-test'
const PORT = 51999

interface StorageState {
  local: Record<string, unknown>
  session: Record<string, unknown>
}

interface SelectorPostRecord {
  requestId: string
  body: Record<string, unknown>
}

function createWorkerSandbox(
  options: {
    storage?: StorageState
    tabUrl?: string
    answerSelector?: (body: Record<string, unknown>) =>
      | Promise<{ status: number; body: Record<string, unknown> }>
      | {
          status: number
          body: Record<string, unknown>
        }
  } = {}
) {
  const storage: StorageState = options.storage ?? {
    local: {
      profileId: PROFILE_ID,
      profileName: 'Test Chrome',
      bridgeSecret: SECRET,
      bridgePort: PORT
    },
    session: {}
  }

  let messageListener:
    | ((
        message: unknown,
        sender: unknown,
        sendResponse: (response: unknown) => void
      ) => boolean | void)
    | null = null

  const posts: SelectorPostRecord[] = []
  const broadcasts: unknown[] = []
  let tabUrl = options.tabUrl ?? 'https://chatgpt.com/c/123?secret=1#hash'

  const makeArea = (area: Record<string, unknown>) => ({
    get: async (keys?: string | string[] | null) => {
      if (!keys) return { ...area }
      const list = Array.isArray(keys) ? keys : [keys]
      const out: Record<string, unknown> = {}
      for (const k of list) {
        if (k in area) out[k] = structuredClone(area[k])
      }
      return out
    },
    set: async (values: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(values)) area[k] = structuredClone(v)
    }
  })

  const chrome = {
    runtime: {
      id: 'ext-test-id',
      lastError: null as unknown,
      getManifest: () => ({ version: '1.0.0' }),
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      onMessage: {
        addListener: (fn: typeof messageListener) => {
          messageListener = fn
        }
      },
      sendMessage: (msg: unknown, cb?: () => void) => {
        broadcasts.push(msg)
        cb?.()
      }
    },
    alarms: {
      create: () => {},
      clear: async () => true,
      onAlarm: { addListener: () => {} }
    },
    cookies: {
      getAll: async () => [],
      onChanged: { addListener: () => {} }
    },
    permissions: {
      contains: async () => true
    },
    tabs: {
      get: async (tabId: number) => ({ id: tabId, url: tabUrl }),
      sendMessage: async () => ({ ok: true })
    },
    scripting: {
      executeScript: async () => [{ frameId: 0, documentId: 'doc-1' }]
    },
    webNavigation: {
      onCompleted: {
        addListener: () => {},
        removeListener: () => {},
        hasListener: () => false
      }
    },
    storage: {
      local: makeArea(storage.local),
      session: makeArea(storage.session),
      onChanged: { addListener: () => {} }
    }
  }

  const fetchMock = async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/selectors/sites')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          version: 1,
          sites: [
            {
              siteId: 'chatgpt',
              displayName: 'ChatGPT',
              hostname: 'chatgpt.com',
              hosts: ['chatgpt.com'],
              fields: ['input', 'button']
            }
          ]
        })
      }
    }
    if (url.endsWith('/api/selectors')) {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      posts.push({ requestId: String(parsed.requestId ?? ''), body: parsed })
      const answer = options.answerSelector
        ? await options.answerSelector(parsed)
        : { status: 200, body: { status: 'saved', saved: true } }
      return {
        ok: answer.status >= 200 && answer.status < 300,
        status: answer.status,
        json: async () => answer.body
      }
    }
    if (url.endsWith('/api/health')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, instanceId: 'inst-1', selectedProfileId: PROFILE_ID })
      }
    }
    if (url.endsWith('/api/sites')) {
      return { ok: true, status: 200, json: async () => ({ sites: [] }) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }

  const context = vm.createContext({
    chrome,
    fetch: fetchMock,
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    AbortSignal: globalThis.AbortSignal,
    URL: globalThis.URL,
    Date: globalThis.Date,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  })
  vm.runInContext(SOURCE, context)

  const send = (message: unknown, sender?: unknown) =>
    new Promise<Record<string, unknown>>((resolve) => {
      if (!messageListener) throw new Error('no message listener')
      const asyncResp = messageListener(message, sender ?? {}, (resp) =>
        resolve((resp ?? {}) as Record<string, unknown>)
      )
      if (!asyncResp) {
        // synchronous sendResponse already called
      }
    })

  return {
    storage,
    posts,
    broadcasts,
    send,
    setTabUrl: (next: string) => {
      tabUrl = next
    }
  }
}

function pickPayload(overrides: Record<string, unknown> = {}) {
  return {
    selector: '#prompt',
    candidates: ['#prompt', 'textarea[data-testid="prompt"]'],
    fingerprint: { tag: 'textarea', dataTestId: 'prompt', text: 'private draft' },
    sourceUrl: 'https://chatgpt.com/c/123?token=secret#frag',
    ...overrides
  }
}

describe('extension selector transfer lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T18:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects a delayed result after the session was cancelled', async () => {
    const worker = createWorkerSandbox()
    const started = await worker.send({ type: 'selector_start', tabId: 7, field: 'input' })
    expect(started.success).toBe(true)

    const cancelled = await worker.send(
      { type: 'selector_pick_cancelled', sessionId: started.sessionId },
      { tab: { id: 7 } }
    )
    expect(cancelled.ok).toBe(true)

    const delayed = await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: started.sessionId,
        field: 'input',
        payload: pickPayload()
      },
      { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
    )
    expect(delayed.ok).toBe(false)
    expect(worker.posts).toHaveLength(0)
  })

  it('rejects an old session result after a new selection started on the same tab', async () => {
    const worker = createWorkerSandbox()
    const first = await worker.send({ type: 'selector_start', tabId: 7, field: 'input' })
    const second = await worker.send({ type: 'selector_start', tabId: 7, field: 'button' })
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)

    const stale = await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: first.sessionId,
        field: 'input',
        payload: pickPayload()
      },
      { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
    )
    expect(stale.ok).toBe(false)
    expect(worker.posts).toHaveLength(0)
  })

  it('rejects an expired session', async () => {
    const worker = createWorkerSandbox()
    const started = await worker.send({ type: 'selector_start', tabId: 7, field: 'input' })
    vi.advanceTimersByTime(11 * 60 * 1000)

    const expired = await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: started.sessionId,
        field: 'input',
        payload: pickPayload()
      },
      { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
    )
    expect(expired.ok).toBe(false)
    expect(worker.posts).toHaveLength(0)
  })

  it('keeps the same requestId on retryable failure and rotates it when fingerprint or candidates change', async () => {
    let attempt = 0
    const worker = createWorkerSandbox({
      answerSelector: () => {
        attempt += 1
        if (attempt === 1) return { status: 409, body: { error: 'site_not_open' } }
        return { status: 200, body: { status: 'saved', saved: true } }
      }
    })
    const started = await worker.send({ type: 'selector_start', tabId: 7, field: 'input' })
    const sender = { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }

    const first = await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: started.sessionId,
        field: 'input',
        payload: pickPayload()
      },
      sender
    )
    expect(first.retryable).toBe(true)

    // Retry identical payload -> same requestId
    const second = await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: started.sessionId,
        field: 'input',
        payload: pickPayload()
      },
      sender
    )
    expect(second.ok).toBe(true)
    expect(worker.posts).toHaveLength(2)
    expect(worker.posts[0].requestId).toBe(worker.posts[1].requestId)

    // Minimized URL & stripped input text
    expect(worker.posts[0].body.sourceUrl).toBe('https://chatgpt.com/c/123')
    expect((worker.posts[0].body.fingerprint as Record<string, unknown>).text).toBeUndefined()

    // Saved session with DIFFERENT payload must be rejected (no false success)
    const differentAfterSave = await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: started.sessionId,
        field: 'input',
        payload: pickPayload({ candidates: ['#prompt', '#other'] })
      },
      sender
    )
    expect(differentAfterSave.ok).toBe(false)
  })

  it('rotates requestId when selector is unchanged but fingerprint changes', async () => {
    const worker = createWorkerSandbox({
      answerSelector: () => ({ status: 409, body: { error: 'site_not_open' } })
    })
    const started = await worker.send({ type: 'selector_start', tabId: 7, field: 'button' })
    const sender = { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }

    await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: started.sessionId,
        field: 'button',
        payload: pickPayload({
          selector: 'button',
          candidates: ['button'],
          fingerprint: { tag: 'button', ariaLabel: 'Send' }
        })
      },
      sender
    )
    await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: started.sessionId,
        field: 'button',
        payload: pickPayload({
          selector: 'button',
          candidates: ['button'],
          fingerprint: { tag: 'button', ariaLabel: 'Voice' }
        })
      },
      sender
    )

    expect(worker.posts).toHaveLength(2)
    expect(worker.posts[0].requestId).not.toBe(worker.posts[1].requestId)
  })

  it('persists cancellation and retryable requestId across service worker restart', async () => {
    const worker = createWorkerSandbox({
      answerSelector: () => ({ status: 409, body: { error: 'site_not_open' } })
    })
    const retryableSession = await worker.send({ type: 'selector_start', tabId: 7, field: 'input' })
    const cancelledSession = await worker.send({ type: 'selector_start', tabId: 8, field: 'input' })
    const sender7 = { tab: { id: 7 }, frameId: 0, documentId: 'doc-1' }
    const sender8 = { tab: { id: 8 }, frameId: 0, documentId: 'doc-1' }

    await worker.send(
      {
        type: 'selector_pick_result',
        sessionId: retryableSession.sessionId,
        field: 'input',
        payload: pickPayload()
      },
      sender7
    )
    await worker.send(
      { type: 'selector_pick_cancelled', sessionId: cancelledSession.sessionId },
      { tab: { id: 8 } }
    )
    const firstRequestId = worker.posts[0].requestId

    // Restart worker with the same persisted storage
    const restarted = createWorkerSandbox({
      storage: worker.storage,
      answerSelector: () => ({ status: 200, body: { status: 'saved', saved: true } })
    })

    const retried = await restarted.send(
      {
        type: 'selector_pick_result',
        sessionId: retryableSession.sessionId,
        field: 'input',
        payload: pickPayload()
      },
      sender7
    )
    expect(retried.ok).toBe(true)
    expect(restarted.posts[0].requestId).toBe(firstRequestId)

    const lateCancelled = await restarted.send(
      {
        type: 'selector_pick_result',
        sessionId: cancelledSession.sessionId,
        field: 'input',
        payload: pickPayload()
      },
      sender8
    )
    expect(lateCancelled.ok).toBe(false)
    expect(restarted.posts).toHaveLength(1)
  })
})
