/**
 * The HTTP half of the selector transfer.
 *
 * Origin, environment and profile handling are shared with the cookie bridge
 * and tested there; this suite pins what is specific to a pick: the signed
 * payload, the idempotency key, the body bound and the answers that tell the
 * extension whether the app stored anything.
 */
import { createHmac } from 'node:crypto'
import { EventEmitter } from 'node:events'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SELECTOR_REQUEST_ID_HEADER,
  SELECTOR_TRANSFER_PATH,
  selectorSitesSigningPayload,
  selectorTransferSigningPayload
} from '../../../../shared/constants/selectorTransfer.js'

const SECRET = 'selector-bridge-secret'
const PROFILE_ID = 'test-profile-1234'
const REQUEST_ID = 'request-0123456789abcdef'

const readAiConfigMap = vi.hoisted(() => vi.fn(async () => ({})))
const saveAiConfigPatch = vi.hoisted(() => vi.fn(async () => true))
const executeAiViewScript = vi.hoisted(() =>
  vi.fn(async (): Promise<unknown> => ({
    success: true,
    action: 'verify_locator',
    field: 'input',
    matchedSelector: '#composer',
    strategy: 'direct',
    descriptor: { tag: 'textarea', dataTestId: 'prompt' },
    diagnostics: { input: { ambiguous: false } }
  }))
)
const listManagedAiViewIds = vi.hoisted(() => vi.fn(() => ['tab-1']))
const getAiViewUrl = vi.hoisted(() => vi.fn(() => 'https://chatgpt.com/'))

const SITE = {
  siteId: 'chatgpt',
  displayName: 'ChatGPT',
  hostname: 'chatgpt.com',
  hosts: ['chatgpt.com', 'openai.com'],
  fields: ['input', 'button'] as Array<'input' | 'button'>,
  canonicalHostname: 'openai.com'
}

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

vi.mock('../../../../electron/features/ai-view/aiWebContentsViewManager.js', () => ({
  listManagedAiViewIds,
  getAiViewUrl,
  executeAiViewScript,
  getAiViewDocumentToken: () => '1:1',
  getManagedAiView: (viewId: string) => ({
    viewId,
    visible: true,
    isLoading: false,
    loadError: null,
    generation: 1
  })
}))

vi.mock('../../../../electron/features/ai/aiConfigHandlers.js', () => ({
  readAiConfigMap,
  saveAiConfigPatch
}))

vi.mock('../../../../electron/features/ai/selectorTargets.js', () => ({
  buildSelectorSiteTargets: async () => [SITE],
  hostBelongsToSelectorSite: (host: string, site: typeof SITE) =>
    site.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)),
  findSelectorSiteMatch: (host: string, sites: Array<typeof SITE>) => {
    const site = sites.find((entry) =>
      entry.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
    )
    return site ? { site, ambiguous: false } : null
  },
  matchSelectorSite: (host: string, sites: Array<typeof SITE>) =>
    sites.find((site) =>
      site.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
    ) ?? null,
  statusOfSite: () => ({ input: 'ready', button: 'missing' })
}))

import {
  handleSelectorBridgeRequest as importBridgeHandler,
  selectLiveViewForSite
} from '../../../../electron/features/native-messaging/selectorBridge.js'

let handleSelectorBridgeRequest: typeof importBridgeHandler

interface ResponseDouble {
  setHeader: ReturnType<typeof vi.fn>
  writeHead: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  readonly status: number | null
  readonly body: unknown
}

function createResponse(): ResponseDouble {
  let status: number | null = null
  let body: unknown = null
  const response = {
    setHeader: vi.fn(),
    writeHead: vi.fn((value: number) => {
      status = value
    }),
    end: vi.fn((chunk?: unknown) => {
      if (typeof chunk === 'string') {
        try {
          body = JSON.parse(chunk)
        } catch {
          body = chunk
        }
      }
    }),
    get status() {
      return status
    },
    get body() {
      return body
    }
  }
  return response as unknown as ResponseDouble
}

function createRequest(options: {
  method: string
  url: string
  headers?: Record<string, string>
}): EventEmitter & {
  method: string
  url: string
  headers: Record<string, string>
  socket: { end: () => void }
} {
  return Object.assign(new EventEmitter(), {
    method: options.method,
    url: options.url,
    headers: options.headers ?? {},
    socket: { end: vi.fn() }
  })
}

function signGet(): string {
  return createHmac('sha256', SECRET).update(selectorSitesSigningPayload(PROFILE_ID)).digest('hex')
}

function signPost(body: string, requestId = REQUEST_ID): string {
  return createHmac('sha256', SECRET)
    .update(selectorTransferSigningPayload(PROFILE_ID, requestId, body))
    .digest('hex')
}

function payloadBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    requestId: REQUEST_ID,
    hostname: 'chatgpt.com',
    field: 'input',
    selector: '#composer',
    candidates: ['#composer'],
    fingerprint: { tag: 'textarea', dataTestId: 'prompt' },
    sourceUrl: 'https://chatgpt.com/',
    ...overrides
  })
}

const MANAGER = {
  _sharedSecret: SECRET,
  markExtensionSeen: vi.fn(),
  markExtensionPaired: vi.fn()
}

const PROFILE = { id: PROFILE_ID, name: 'Test Chrome' }

async function send(
  request: ReturnType<typeof createRequest>,
  body?: string
): Promise<ResponseDouble> {
  const response = createResponse()
  const handled = handleSelectorBridgeRequest(request as never, response as never, MANAGER, PROFILE)
  expect(handled).toBe(true)
  if (body !== undefined) {
    request.emit('data', Buffer.from(body))
    request.emit('end')
  }
  // The handler answers after a few asynchronous hops (body read, dynamic
  // module load, verification). Wait for the answer instead of guessing a
  // number of microtask turns, so one test cannot leak work into the next.
  const startedAt = Date.now()
  while (response.status === null && Date.now() - startedAt < 2000) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return response
}

describe('selector bridge routes', () => {
  beforeEach(async () => {
    // The bridge remembers answered request ids and caches its ingestion for
    // the life of the process; each test starts from a fresh module, exactly
    // like a restarted bridge.
    vi.resetModules()
    ;({ handleSelectorBridgeRequest } =
      await import('../../../../electron/features/native-messaging/selectorBridge.js'))
    readAiConfigMap.mockClear()
    saveAiConfigPatch.mockClear()
    executeAiViewScript.mockClear()
    listManagedAiViewIds.mockReset()
    listManagedAiViewIds.mockReturnValue(['tab-1'])
    getAiViewUrl.mockReset()
    getAiViewUrl.mockReturnValue('https://chatgpt.com/')
    MANAGER.markExtensionSeen.mockClear()
    MANAGER.markExtensionPaired.mockClear()
    executeAiViewScript.mockResolvedValue({
      success: true,
      action: 'verify_locator',
      field: 'input',
      matchedSelector: '#composer',
      strategy: 'direct',
      descriptor: { tag: 'textarea', dataTestId: 'prompt' },
      diagnostics: { input: { ambiguous: false } }
    })
  })

  it('ignores paths that are not selector endpoints', () => {
    const request = createRequest({ method: 'GET', url: '/api/cookies' })
    const response = createResponse()
    expect(handleSelectorBridgeRequest(request as never, response as never, MANAGER, PROFILE)).toBe(
      false
    )
  })

  it('answers the signed site catalogue with the stored status', async () => {
    const request = createRequest({
      method: 'GET',
      url: '/api/selectors/sites',
      headers: { 'x-hmac-signature': signGet() }
    })
    const response = await send(request)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      version: 1,
      sites: [
        {
          siteId: 'chatgpt',
          hostname: 'chatgpt.com',
          fields: ['input', 'button'],
          status: { input: 'ready', button: 'missing' }
        }
      ]
    })
    expect(MANAGER.markExtensionPaired).toHaveBeenCalledWith(PROFILE_ID)
  })

  it('refuses the site catalogue without a valid signature', async () => {
    const request = createRequest({
      method: 'GET',
      url: '/api/selectors/sites',
      headers: { 'x-hmac-signature': 'a'.repeat(64) }
    })
    const response = await send(request)
    expect(response.status).toBe(401)
    expect(MANAGER.markExtensionPaired).not.toHaveBeenCalled()
  })

  it('stores a signed pick and reports it as saved', async () => {
    const body = payloadBody()
    const request = createRequest({
      method: 'POST',
      url: SELECTOR_TRANSFER_PATH,
      headers: {
        'x-hmac-signature': signPost(body),
        [SELECTOR_REQUEST_ID_HEADER]: REQUEST_ID
      }
    })
    const response = await send(request, body)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'saved', saved: true, field: 'input' })
    expect(saveAiConfigPatch).toHaveBeenCalledTimes(1)
    expect(saveAiConfigPatch).toHaveBeenCalledWith(
      'chatgpt.com',
      expect.objectContaining({ input: '#composer' }),
      { pickedField: 'input' }
    )
  })

  it('rejects a body whose signature does not match', async () => {
    const body = payloadBody()
    const request = createRequest({
      method: 'POST',
      url: SELECTOR_TRANSFER_PATH,
      headers: {
        'x-hmac-signature': signPost(payloadBody({ selector: '#other', candidates: ['#other'] })),
        [SELECTOR_REQUEST_ID_HEADER]: REQUEST_ID
      }
    })
    const response = await send(request, body)

    expect(response.status).toBe(401)
    expect(saveAiConfigPatch).not.toHaveBeenCalled()
    expect(executeAiViewScript).not.toHaveBeenCalled()
  })

  it('requires an idempotency key before it reads the body', async () => {
    const request = createRequest({
      method: 'POST',
      url: SELECTOR_TRANSFER_PATH,
      headers: { 'x-hmac-signature': 'a'.repeat(64) }
    })
    const response = await send(request, payloadBody())
    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ error: 'invalid_request_id' })
  })

  it('replays the real result of a retried request instead of writing twice', async () => {
    const body = payloadBody({ requestId: 'first-request-0123456789' })
    const headers = {
      'x-hmac-signature': signPost(body, 'first-request-0123456789'),
      [SELECTOR_REQUEST_ID_HEADER]: 'first-request-0123456789'
    }
    const first = await send(
      createRequest({ method: 'POST', url: SELECTOR_TRANSFER_PATH, headers }),
      body
    )
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ status: 'saved', saved: true })

    const second = await send(
      createRequest({ method: 'POST', url: SELECTOR_TRANSFER_PATH, headers }),
      body
    )
    // The retry gets the first attempt's real answer, not a bare "duplicate".
    expect(second.status).toBe(200)
    expect(second.body).toMatchObject({ status: 'saved', saved: true })
    expect(saveAiConfigPatch).toHaveBeenCalledTimes(1)
  })

  it('replays a deterministic refusal instead of turning it into a success', async () => {
    const body = payloadBody({ requestId: 'refused-request-0123456789', version: 9 })
    const headers = {
      'x-hmac-signature': signPost(body, 'refused-request-0123456789'),
      [SELECTOR_REQUEST_ID_HEADER]: 'refused-request-0123456789'
    }
    const first = await send(
      createRequest({ method: 'POST', url: SELECTOR_TRANSFER_PATH, headers }),
      body
    )
    expect(first.status).toBe(400)
    expect(first.body).toMatchObject({ error: 'invalid_payload' })

    const second = await send(
      createRequest({ method: 'POST', url: SELECTOR_TRANSFER_PATH, headers }),
      body
    )
    expect(second.status).toBe(400)
    expect(second.body).toMatchObject({ error: 'invalid_payload' })
  })

  it('refuses the same request id with a different body', async () => {
    const requestId = 'reuse-request-0123456789'
    const firstBody = payloadBody({ requestId })
    const firstHeaders = {
      'x-hmac-signature': signPost(firstBody, requestId),
      [SELECTOR_REQUEST_ID_HEADER]: requestId
    }
    expect(
      (
        await send(
          createRequest({ method: 'POST', url: SELECTOR_TRANSFER_PATH, headers: firstHeaders }),
          firstBody
        )
      ).status
    ).toBe(200)

    const secondBody = payloadBody({
      requestId,
      selector: 'textarea[data-testid="prompt"]',
      candidates: ['textarea[data-testid="prompt"]'],
      fingerprint: { tag: 'textarea', dataTestId: 'prompt' }
    })
    const second = await send(
      createRequest({
        method: 'POST',
        url: SELECTOR_TRANSFER_PATH,
        headers: {
          'x-hmac-signature': signPost(secondBody, requestId),
          [SELECTOR_REQUEST_ID_HEADER]: requestId
        }
      }),
      secondBody
    )
    expect(second.status).toBe(409)
    expect(second.body).toMatchObject({ error: 'request_id_reuse', retryable: false })
    expect(saveAiConfigPatch).toHaveBeenCalledTimes(1)
  })

  it('requires the header and the body to name the same request id', async () => {
    const body = payloadBody({ requestId: 'another-request-0123456789' })
    const response = await send(
      createRequest({
        method: 'POST',
        url: SELECTOR_TRANSFER_PATH,
        headers: {
          'x-hmac-signature': signPost(body, REQUEST_ID),
          [SELECTOR_REQUEST_ID_HEADER]: REQUEST_ID
        }
      }),
      body
    )
    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ error: 'invalid_payload', reason: 'request_id_mismatch' })
    expect(saveAiConfigPatch).not.toHaveBeenCalled()
  })

  it('answers two concurrent copies of one request with one write', async () => {
    const body = payloadBody({ requestId: 'concurrent-request-0123456789' })
    const headers = {
      'x-hmac-signature': signPost(body, 'concurrent-request-0123456789'),
      [SELECTOR_REQUEST_ID_HEADER]: 'concurrent-request-0123456789'
    }
    const firstRequest = createRequest({
      method: 'POST',
      url: SELECTOR_TRANSFER_PATH,
      headers
    })
    const secondRequest = createRequest({
      method: 'POST',
      url: SELECTOR_TRANSFER_PATH,
      headers
    })
    const firstResponse = createResponse()
    const secondResponse = createResponse()
    expect(
      handleSelectorBridgeRequest(firstRequest as never, firstResponse as never, MANAGER, PROFILE)
    ).toBe(true)
    expect(
      handleSelectorBridgeRequest(secondRequest as never, secondResponse as never, MANAGER, PROFILE)
    ).toBe(true)
    firstRequest.emit('data', Buffer.from(body))
    secondRequest.emit('data', Buffer.from(body))
    firstRequest.emit('end')
    secondRequest.emit('end')

    const deadline = Date.now() + 2000
    while (
      (firstResponse.status === null || secondResponse.status === null) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(firstResponse.body).toMatchObject({ status: 'saved' })
    expect(secondResponse.body).toMatchObject({ status: 'saved' })
    expect(saveAiConfigPatch).toHaveBeenCalledTimes(1)
  })

  it('does not remember "the site is not open", so opening it allows a retry', async () => {
    listManagedAiViewIds.mockReturnValueOnce([]).mockReturnValueOnce(['tab-1'])
    const body = payloadBody({ requestId: 'retry-request-0123456789' })
    const headers = {
      'x-hmac-signature': signPost(body, 'retry-request-0123456789'),
      [SELECTOR_REQUEST_ID_HEADER]: 'retry-request-0123456789'
    }

    const first = await send(
      createRequest({ method: 'POST', url: SELECTOR_TRANSFER_PATH, headers }),
      body
    )
    expect(first.status).toBe(409)
    expect(first.body).toMatchObject({ error: 'site_not_open' })

    const second = await send(
      createRequest({ method: 'POST', url: SELECTOR_TRANSFER_PATH, headers }),
      body
    )
    expect(second.status).toBe(200)
    expect(saveAiConfigPatch).toHaveBeenCalledTimes(1)
  })

  it('answers a verification failure with 422 and writes nothing', async () => {
    executeAiViewScript.mockResolvedValueOnce({
      success: true,
      field: 'input',
      matchedSelector: '#a-twin',
      strategy: 'direct'
    })
    const body = payloadBody()
    const request = createRequest({
      method: 'POST',
      url: SELECTOR_TRANSFER_PATH,
      headers: {
        'x-hmac-signature': signPost(body),
        [SELECTOR_REQUEST_ID_HEADER]: REQUEST_ID
      }
    })
    const response = await send(request, body)
    expect(response.status).toBe(422)
    expect(response.body).toMatchObject({ error: 'verification_failed' })
    expect(saveAiConfigPatch).not.toHaveBeenCalled()
  })

  it('refuses a body that is larger than the transfer allows', async () => {
    const body = payloadBody({ fingerprint: { tag: 'x'.repeat(40 * 1024) } })
    const request = createRequest({
      method: 'POST',
      url: SELECTOR_TRANSFER_PATH,
      headers: {
        'x-hmac-signature': signPost(body),
        [SELECTOR_REQUEST_ID_HEADER]: REQUEST_ID
      }
    })
    const response = await send(request, body)
    expect(response.status).toBe(413)
    expect(saveAiConfigPatch).not.toHaveBeenCalled()
  })
})

describe('selectLiveViewForSite', () => {
  const realMatch = (host: string, sites: readonly (typeof SITE)[], pathname?: string) => {
    if (pathname && /^\/(?:auth|login|signin|account|oauth)(?:\/|$)/i.test(pathname)) {
      return null
    }
    const exact = sites.find((s) => s.hostname === host)
    if (exact) return { site: exact, ambiguous: false }
    const sibling = sites.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)))
    return sibling ? { site: sibling, ambiguous: false } : null
  }

  it('skips a login view and selects the second valid chat view', () => {
    const selected = selectLiveViewForSite(
      SITE,
      [SITE],
      {
        listManagedAiViewIds: () => ['view-login', 'view-chat'],
        getAiViewUrl: (id) =>
          id === 'view-login' ? 'https://chatgpt.com/auth/login' : 'https://chatgpt.com/c/123',
        getAiViewDocumentToken: (id) => (id === 'view-chat' ? '2:1' : '1:1')
      },
      realMatch
    )
    expect(selected).toEqual({
      viewId: 'view-chat',
      url: 'https://chatgpt.com/c/123',
      documentToken: '2:1'
    })
  })

  it('ignores a sibling site under the same canonical domain', () => {
    const gemini = {
      siteId: 'gemini',
      displayName: 'Gemini',
      hostname: 'gemini.google.com',
      hosts: ['gemini.google.com'],
      fields: ['input', 'button'] as Array<'input' | 'button'>,
      canonicalHostname: 'google.com'
    }
    const aistudio = {
      siteId: 'aistudio',
      displayName: 'AI Studio',
      hostname: 'aistudio.google.com',
      hosts: ['aistudio.google.com'],
      fields: ['input', 'button'] as Array<'input' | 'button'>,
      canonicalHostname: 'google.com'
    }
    const selected = selectLiveViewForSite(
      gemini,
      [gemini, aistudio],
      {
        listManagedAiViewIds: () => ['view-studio', 'view-gemini'],
        getAiViewUrl: (id) =>
          id === 'view-studio'
            ? 'https://aistudio.google.com/prompts/new'
            : 'https://gemini.google.com/app'
      },
      realMatch
    )
    expect(selected?.viewId).toBe('view-gemini')
  })

  it('deterministically prefers healthy, settled, visible views when multiple are valid', () => {
    const selected = selectLiveViewForSite(
      SITE,
      [SITE],
      {
        listManagedAiViewIds: () => ['view-hidden', 'view-visible'],
        getAiViewUrl: () => 'https://chatgpt.com/',
        getViewRuntimeState: (id) =>
          id === 'view-visible'
            ? { visible: true, isLoading: false, hasError: false, generation: 2 }
            : { visible: false, isLoading: false, hasError: false, generation: 5 }
      },
      realMatch
    )
    expect(selected?.viewId).toBe('view-visible')
  })

  it('skips a view that closes during selection and returns null when none remain', () => {
    const selected = selectLiveViewForSite(
      SITE,
      [SITE],
      {
        listManagedAiViewIds: () => ['view-closing'],
        getAiViewUrl: () => 'https://chatgpt.com/',
        getViewRuntimeState: () => null
      },
      realMatch
    )
    expect(selected).toBeNull()
  })
})
