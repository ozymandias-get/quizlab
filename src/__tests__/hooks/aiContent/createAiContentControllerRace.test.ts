/**
 * Controller lifecycle races.
 *
 * Every operation here is a round trip, and the tab can be closed, slept or
 * evicted while one is still in the air. The controller therefore stamps each
 * lifecycle mutation and drops the completions that belong to a superseded one.
 *
 * The mocks use controlled promises on purpose: resolving an attach *after* a
 * destroy is the only way to reach the stale branch, and an `async` mock that
 * resolves immediately would hide it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiViewAttachResponse, AiViewEvent } from '@shared-core/types/aiView'

const aiViewClient = vi.hoisted(() => ({
  attach: vi.fn(),
  detach: vi.fn(),
  destroy: vi.fn(),
  reload: vi.fn(),
  loadUrl: vi.fn(),
  navigate: vi.fn(),
  getUrl: vi.fn(),
  executeScript: vi.fn(),
  insertText: vi.fn(),
  sendInputEvent: vi.fn(),
  paste: vi.fn(),
  focus: vi.fn(),
  syncHost: vi.fn(),
  onEvent: vi.fn()
}))

const electronApi = vi.hoisted(() => ({ aiView: aiViewClient }))
vi.mock('@shared/lib/electronApi', () => ({ getElectronApi: () => electronApi }))

vi.mock('@shared/lib/logger', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  reportSuppressedError: vi.fn()
}))

const { createAiContentController } =
  await import('@shared/hooks/aiContent/createAiContentController')

type Emitter = (event: AiViewEvent) => void

let emit: Emitter = () => {}

const freshResponse = (generation: number): AiViewAttachResponse => ({
  generation,
  currentUrl: 'https://chatgpt.com/',
  isLoading: true,
  hasLoadedOnce: false,
  error: null
})

/** An attach whose answer the test decides when to deliver. */
function deferredAttach() {
  const deferred: { resolve?: (value: AiViewAttachResponse) => void } = {}
  const promise = new Promise<AiViewAttachResponse>((resolve) => {
    deferred.resolve = resolve
  })
  aiViewClient.attach.mockReturnValueOnce(promise)
  return deferred
}

const makeController = (viewId = 'tab-1') =>
  createAiContentController({ viewId, source: { kind: 'ai-platform', modelId: 'chatgpt' } })

beforeEach(() => {
  vi.clearAllMocks()
  aiViewClient.onEvent.mockImplementation((handler: Emitter) => {
    emit = handler
    return () => {}
  })
  aiViewClient.attach.mockResolvedValue(freshResponse(7))
  aiViewClient.destroy.mockResolvedValue(true)
  aiViewClient.executeScript.mockResolvedValue('ok')
  aiViewClient.paste.mockResolvedValue(true)
})

describe('createAiContentController - state invariants', () => {
  it.each(['retirement', 'host disposal'])(
    'does not recreate after %s supersedes its pending destroy',
    async (action) => {
      const controller = makeController()
      await controller.attach()
      let finishDestroy: (value: boolean) => void = () => {}
      aiViewClient.destroy.mockReturnValueOnce(
        new Promise<boolean>((resolve) => {
          finishDestroy = resolve
        })
      )
      const recovering = controller.recreate()
      if (action === 'retirement') await controller.destroy()
      else controller.dispose()
      finishDestroy(true)
      await expect(recovering).resolves.toBe(false)
      expect(aiViewClient.attach).toHaveBeenCalledTimes(1)
      expect(controller.isReady?.()).toBe(false)
      expect(controller.isDestroyed?.()).toBe(true)
    }
  )

  it('starts fresh: not ready, destroyed, no generation', () => {
    const controller = makeController()
    expect(controller.isReady?.()).toBe(false)
    expect(controller.isDestroyed?.()).toBe(true)
    expect(controller.getURL?.()).toBeUndefined()
  })

  it('reports nothing usable while the attach is pending', async () => {
    const pending = deferredAttach()
    const controller = makeController()

    const attached = controller.attach()
    expect(controller.isReady?.()).toBe(false)
    expect(controller.isDestroyed?.()).toBe(true)

    pending.resolve?.(freshResponse(7))
    await attached
    expect(controller.isReady?.()).toBe(true)
    expect(controller.isDestroyed?.()).toBe(false)
  })

  it('drops readiness, loading and the generation on destroy', async () => {
    const controller = makeController()
    await controller.attach()
    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-stop-loading',
      currentUrl: 'https://chatgpt.com/'
    })

    await controller.destroy()

    expect(controller.isReady?.()).toBe(false)
    expect(controller.isDestroyed?.()).toBe(true)
    expect(controller.isLoading?.()).toBe(false)

    // The generation is gone, so events from the destroyed view are filtered out.
    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))
    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/ghost',
      isMainFrame: true
    })
    expect(seen).toEqual([])
  })

  it('bootstraps an existing settled view as ready, idle and already painted', async () => {
    // Exactly what a focus-mode handoff receives: the same generation, and no load
    // event will ever arrive for this generation again.
    aiViewClient.attach.mockResolvedValueOnce({
      generation: 12,
      currentUrl: 'https://chatgpt.com/c/abc',
      isLoading: false,
      hasLoadedOnce: true,
      error: null
    })

    const controller = makeController()
    const states: Array<{ isLoading: boolean; hasLoadedOnce: boolean }> = []
    controller.subscribeEvent?.('state', (event) => {
      states.push({ isLoading: event.isLoading, hasLoadedOnce: event.hasLoadedOnce })
    })

    await controller.attach()

    expect(controller.isReady?.()).toBe(true)
    expect(controller.isLoading?.()).toBe(false)
    expect(controller.getURL?.()).toBe('https://chatgpt.com/c/abc')
    expect(states).toEqual([{ isLoading: false, hasLoadedOnce: true }])
  })

  it('bootstraps an existing still-loading view as ready but still loading', async () => {
    aiViewClient.attach.mockResolvedValueOnce({
      generation: 12,
      currentUrl: 'https://chatgpt.com/',
      isLoading: true,
      hasLoadedOnce: false,
      error: null
    })

    const controller = makeController()
    const settled: boolean[] = []
    controller.subscribeEvent?.('state', (event) => settled.push(event.hasLoadedOnce))

    await controller.attach()

    expect(controller.isReady?.()).toBe(true)
    expect(controller.isLoading?.()).toBe(true)
    expect(settled).toEqual([false])
  })

  it('carries the last load failure of an existing view to its new host', async () => {
    aiViewClient.attach.mockResolvedValueOnce({
      generation: 12,
      currentUrl: 'https://chatgpt.com/',
      isLoading: false,
      hasLoadedOnce: true,
      error: { code: -105, description: 'ERR_NAME_NOT_RESOLVED' }
    })

    const controller = makeController()
    const errors: Array<{ code: number; description: string } | null> = []
    controller.subscribeEvent?.('state', (event) => errors.push(event.error))

    await controller.attach()

    expect(errors).toEqual([{ code: -105, description: 'ERR_NAME_NOT_RESOLVED' }])
    expect(controller.isLoading?.()).toBe(false)
  })
})

describe('createAiContentController - attach/destroy race', () => {
  it('ignores an attach that resolves after the destroy that superseded it', async () => {
    const pending = deferredAttach()
    const controller = makeController()

    // Attach is in the air, and the tab is closed underneath it.
    const attached = controller.attach()
    await controller.destroy()
    expect(controller.isReady?.()).toBe(false)

    // The stale answer now arrives, naming a WebContents main has already closed.
    pending.resolve?.(freshResponse(7))
    await expect(attached).resolves.toBe(false)

    expect(controller.isReady?.()).toBe(false)
    expect(controller.isDestroyed?.()).toBe(true)
    await expect(controller.executeJavaScript('1')).resolves.toBeUndefined()
    expect(aiViewClient.executeScript).not.toHaveBeenCalled()
  })

  it('does not resurrect the generation from a stale attach', async () => {
    const pending = deferredAttach()
    const controller = makeController()

    const attached = controller.attach()
    await controller.destroy()
    pending.resolve?.(freshResponse(99))
    await attached

    // A late event for the dead generation must stay filtered out.
    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))
    emit({
      viewId: 'tab-1',
      generation: 99,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/ghost',
      isMainFrame: true
    })
    expect(seen).toEqual([])
  })

  it('treats an attach that fails after the destroy superseded it as inert', async () => {
    const rejected: { reject?: (error: unknown) => void } = {}
    aiViewClient.attach.mockReturnValueOnce(
      new Promise<AiViewAttachResponse>((_resolve, reject) => {
        rejected.reject = reject
      })
    )
    const readyStates: boolean[] = []
    const controller = makeController()
    controller.subscribeReady?.((ready) => readyStates.push(ready))

    const attached = controller.attach()
    await controller.destroy()
    rejected.reject?.(new Error('unknown_view_target'))
    await expect(attached).resolves.toBe(false)

    // Exactly the transition the destroy reported: the late failure adds no
    // second notification and does not claim the controller is merely "not
    // ready" about a view main already closed.
    expect(readyStates).toEqual([false])
    expect(controller.isReady?.()).toBe(false)
    expect(controller.isDestroyed?.()).toBe(true)
  })

  it('lets a fresh attach become ready again after the race', async () => {
    const pending = deferredAttach()
    const controller = makeController()

    const staleAttach = controller.attach()
    await controller.destroy()
    pending.resolve?.(freshResponse(7))
    await staleAttach
    expect(controller.isReady?.()).toBe(false)

    aiViewClient.attach.mockResolvedValueOnce(freshResponse(8))
    await expect(controller.attach()).resolves.toBe(true)

    expect(controller.isReady?.()).toBe(true)
    expect(controller.isDestroyed?.()).toBe(false)
    // The replacement generation is live again.
    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))
    emit({
      viewId: 'tab-1',
      generation: 8,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/new',
      isMainFrame: true
    })
    expect(seen).toEqual(['https://chatgpt.com/c/new'])
  })

  it('keeps the newest of two overlapping attaches', async () => {
    const first = deferredAttach()
    aiViewClient.attach.mockResolvedValueOnce(freshResponse(8))
    const controller = makeController()

    const stale = controller.attach()
    // A crash recovery recreates the view before the first attach came back.
    const fresh = controller.recreate('https://chatgpt.com/c/keep')
    first.resolve?.(freshResponse(7))
    await expect(stale).resolves.toBe(false)
    await expect(fresh).resolves.toBe(true)

    // Generation 8 is the one main actually created; 7 never existed.
    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))
    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/old',
      isMainFrame: true
    })
    emit({
      viewId: 'tab-1',
      generation: 8,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/keep',
      isMainFrame: true
    })
    expect(seen).toEqual(['https://chatgpt.com/c/keep'])
    expect(controller.isReady?.()).toBe(true)
  })
})
