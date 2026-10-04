import type { AiViewEvent } from '@shared-core/types/aiView'

import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => electronApi
}))

const { createAiContentController } =
  await import('@shared/hooks/aiContent/createAiContentController')

type Emitter = (event: AiViewEvent) => void

let emit: Emitter = () => {}

/**
 * The attach response main sends for a view it has just created: the entry load
 * is in flight and nothing has settled yet.
 */
const freshAttachResponse = (generation: number, currentUrl: string) => ({
  generation,
  currentUrl,
  isLoading: true,
  hasLoadedOnce: false,
  loadState: 'loading' as const,
  error: null,
  created: true
})

beforeEach(() => {
  vi.clearAllMocks()
  aiViewClient.onEvent.mockImplementation((handler: Emitter) => {
    emit = handler
    return () => {}
  })
  aiViewClient.attach.mockResolvedValue(freshAttachResponse(7, 'https://x.test/'))
  aiViewClient.executeScript.mockResolvedValue('ok')
  aiViewClient.insertText.mockResolvedValue(true)
  aiViewClient.reload.mockResolvedValue(true)
  aiViewClient.navigate.mockResolvedValue(true)
  aiViewClient.paste.mockResolvedValue(true)
  aiViewClient.focus.mockResolvedValue(true)
  aiViewClient.sendInputEvent.mockResolvedValue(true)
  aiViewClient.loadUrl.mockResolvedValue(true)
  aiViewClient.detach.mockResolvedValue(true)
  aiViewClient.destroy.mockResolvedValue(true)
})

const makeController = (viewId = 'tab-1') =>
  createAiContentController({ viewId, source: { kind: 'ai-platform', modelId: 'chatgpt' } })

describe('createAiContentController - attach', () => {
  it('addresses the managed view by view id and registry key', async () => {
    const controller = makeController('tab-42')
    await controller.attach('https://chatgpt.com/c/1')

    expect(aiViewClient.attach).toHaveBeenCalledWith({
      viewId: 'tab-42',
      source: { kind: 'ai-platform', modelId: 'chatgpt' },
      restoredUrl: 'https://chatgpt.com/c/1'
    })
  })

  it('never sends a partition or webContents id', async () => {
    const controller = makeController()
    await controller.attach()

    const payload = aiViewClient.attach.mock.calls[0][0]
    expect(payload).not.toHaveProperty('partition')
    expect(payload).not.toHaveProperty('webContentsId')
  })

  it('stays destroyed until main confirms the view', async () => {
    const controller = makeController()
    expect(controller.isDestroyed?.()).toBe(true)
    expect(controller.isReady?.()).toBe(false)

    await controller.attach()
    expect(controller.isDestroyed?.()).toBe(false)
    expect(controller.isReady?.()).toBe(true)
  })

  it('stays destroyed when the attach is rejected', async () => {
    aiViewClient.attach.mockRejectedValueOnce(new Error('unknown_view_target'))
    const controller = makeController()
    await expect(controller.attach()).resolves.toBe(false)
    expect(controller.isDestroyed?.()).toBe(true)
  })

  it('mirrors the entry URL reported at attach time', async () => {
    const controller = makeController()
    await controller.attach()
    expect(controller.getURL?.()).toBe('https://x.test/')
  })
})

describe('createAiContentController - event bridge', () => {
  it('delivers events for its own view only', async () => {
    const controller = makeController('tab-1')
    await controller.attach()

    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))

    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/a',
      isMainFrame: true
    })
    emit({
      viewId: 'tab-2',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/b',
      isMainFrame: true
    })

    expect(seen).toEqual(['https://chatgpt.com/a'])
  })

  it('drops events from a previous generation of the same view', async () => {
    const controller = makeController()
    await controller.attach()

    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))

    emit({
      viewId: 'tab-1',
      generation: 6,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/stale',
      isMainFrame: true
    })
    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/fresh',
      isMainFrame: true
    })

    expect(seen).toEqual(['https://chatgpt.com/fresh'])
  })

  it('replays events that arrived while the attach was still in flight', async () => {
    const captured: { resolve?: (value: unknown) => void } = {}
    aiViewClient.attach.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          captured.resolve = resolve
        })
    )

    const controller = makeController()
    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))

    const attached = controller.attach()
    // The guest can finish its first navigation before the invoke resolves.
    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/early',
      isMainFrame: true
    })
    expect(seen).toEqual([])

    captured.resolve?.(freshAttachResponse(7, 'https://x.test/'))
    await attached

    expect(seen).toEqual(['https://chatgpt.com/early'])
  })

  it('tracks the loading flag from lifecycle events', async () => {
    const controller = makeController()
    await controller.attach()

    const base = { viewId: 'tab-1', generation: 7 }
    emit({ ...base, kind: 'did-stop-loading', currentUrl: 'https://x.test/' })
    expect(controller.isLoading?.()).toBe(false)

    emit({ ...base, kind: 'did-start-loading', currentUrl: 'https://x.test/' })
    expect(controller.isLoading?.()).toBe(true)
  })

  it('mirrors the current URL from navigation events', async () => {
    const controller = makeController()
    await controller.attach()

    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/9',
      isMainFrame: true
    })
    expect(controller.getURL?.()).toBe('https://chatgpt.com/c/9')
  })

  it('stops delivering events after dispose', async () => {
    const controller = makeController()
    await controller.attach()

    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))
    controller.dispose()

    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/9',
      isMainFrame: true
    })
    expect(seen).toEqual([])
  })

  it('releases its own event subscriptions on dispose', async () => {
    const controller = makeController('a')
    await controller.attach()

    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))
    controller.dispose()

    emit({
      viewId: 'a',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/x',
      isMainFrame: true
    })
    expect(seen).toEqual([])
  })
})

describe('createAiContentController - commands', () => {
  it('routes every command through the view id', async () => {
    const controller = makeController('tab-7')
    await controller.attach()

    await controller.executeJavaScript('document.readyState')
    expect(aiViewClient.executeScript).toHaveBeenCalledWith({
      viewId: 'tab-7',
      script: 'document.readyState'
    })

    await controller.reload?.()
    expect(aiViewClient.reload).toHaveBeenCalledWith({ viewId: 'tab-7' })

    await controller.goBack?.()
    expect(aiViewClient.navigate).toHaveBeenCalledWith({ viewId: 'tab-7', delta: -1 })

    await controller.goForward?.()
    expect(aiViewClient.navigate).toHaveBeenCalledWith({ viewId: 'tab-7', delta: 1 })

    await controller.insertText?.('hi')
    expect(aiViewClient.insertText).toHaveBeenCalledWith({ viewId: 'tab-7', text: 'hi' })

    await controller.sendInputEvent?.({ type: 'keyDown', keyCode: 'v' })
    expect(aiViewClient.sendInputEvent).toHaveBeenCalledWith({
      viewId: 'tab-7',
      inputEvent: { type: 'keyDown', keyCode: 'v' }
    })

    await controller.loadURL?.('https://chatgpt.com/c/3')
    expect(aiViewClient.loadUrl).toHaveBeenCalledWith({
      viewId: 'tab-7',
      url: 'https://chatgpt.com/c/3'
    })

    await controller.focus?.()
    expect(aiViewClient.focus).toHaveBeenCalledWith({ viewId: 'tab-7' })
  })

  it('pastes natively by view id, with no webContents id in the request', async () => {
    const controller = makeController('tab-7')
    await controller.attach()

    await expect(controller.paste?.()).resolves.toBe(true)
    expect(aiViewClient.paste).toHaveBeenCalledWith({ viewId: 'tab-7' })
    expect(aiViewClient.paste.mock.calls[0][0]).not.toHaveProperty('webContentsId')
  })

  it('degrades to a no-op while the view is not attached', async () => {
    const controller = makeController()

    await expect(controller.executeJavaScript('1')).resolves.toBeUndefined()
    await expect(controller.reload?.()).resolves.toBe(false)
    await expect(controller.paste?.()).resolves.toBe(false)
    expect(controller.getURL?.()).toBeUndefined()
    expect(aiViewClient.executeScript).not.toHaveBeenCalled()
  })
})

describe('createAiContentController - host and crash lifecycle', () => {
  it('releases the host claim without destroying the view', async () => {
    const controller = makeController('tab-1')
    await controller.attach()

    await controller.releaseHost('h1')
    expect(aiViewClient.detach).toHaveBeenCalledWith({ viewId: 'tab-1', hostToken: 'h1' })
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })

  it('recreates the view on crash recovery, restoring the current url', async () => {
    const controller = makeController('tab-1')
    await controller.attach()

    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/keep',
      isMainFrame: true
    })

    aiViewClient.attach.mockResolvedValueOnce(freshAttachResponse(8, 'https://chatgpt.com/c/keep'))
    await controller.recreate()

    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'tab-1' })
    expect(aiViewClient.attach).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewId: 'tab-1', restoredUrl: 'https://chatgpt.com/c/keep' })
    )
    expect(controller.isDestroyed?.()).toBe(false)
  })

  it('accepts events from the new generation after a recreate', async () => {
    const controller = makeController('tab-1')
    await controller.attach()
    aiViewClient.attach.mockResolvedValueOnce(freshAttachResponse(8, 'https://x.test/'))
    await controller.recreate()

    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))
    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/old',
      isMainFrame: true
    })
    emit({
      viewId: 'tab-1',
      generation: 8,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/new',
      isMainFrame: true
    })
    expect(seen).toEqual(['https://chatgpt.com/new'])
  })

  it('reports readiness transitions', async () => {
    const controller = makeController()
    const states: boolean[] = []
    controller.subscribeReady?.((ready) => states.push(ready))

    await controller.attach()
    expect(states).toEqual([false, true])

    controller.dispose()
  })
})

describe('createAiContentController - destroy lifecycle', () => {
  it('mirrors the destroy in its own readiness state', async () => {
    // Regression guard. `destroy()` used to only ask main to tear the view down
    // and left this handle reporting "ready", so the send and picker pipelines
    // treated a destroyed (or slept) view as a live one and injected into a
    // WebContents that no longer existed.
    const controller = makeController('tab-1')

    expect(controller.isDestroyed?.()).toBe(true)
    expect(controller.isReady?.()).toBe(false)

    await controller.attach()
    expect(controller.isDestroyed?.()).toBe(false)
    expect(controller.isReady?.()).toBe(true)

    await controller.destroy()
    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'tab-1' })
    expect(controller.isDestroyed?.()).toBe(true)
    expect(controller.isReady?.()).toBe(false)
  })

  it('drives readiness subscribers through attach then destroy', async () => {
    const controller = makeController('tab-1')
    const states: boolean[] = []
    controller.subscribeReady?.((ready) => states.push(ready))

    await controller.attach()
    await controller.destroy()

    expect(states).toEqual([false, true, false])
  })

  it('stops reporting the guest as loading after a destroy', async () => {
    const controller = makeController('tab-1')
    await controller.attach()
    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-stop-loading',
      currentUrl: 'https://x.test/'
    })
    expect(controller.isLoading?.()).toBe(false)

    await controller.destroy()
    expect(controller.isLoading?.()).toBe(false)
  })

  it('refuses every automation command once destroyed', async () => {
    // A sleeping or retired view must not be addressed: main answers with a
    // plain `false` / `null`, and the pipeline should see that without a
    // round trip to a view that is gone.
    const controller = makeController('tab-1')
    await controller.attach()
    await controller.destroy()

    aiViewClient.executeScript.mockClear()
    aiViewClient.insertText.mockClear()
    aiViewClient.paste.mockClear()

    expect(controller.isDestroyed?.()).toBe(true)
    await expect(controller.executeJavaScript('1')).resolves.toBeUndefined()
    await expect(controller.insertText?.('hi')).resolves.toBe(false)
    await expect(controller.paste?.()).resolves.toBe(false)
    expect(aiViewClient.executeScript).not.toHaveBeenCalled()
    expect(aiViewClient.insertText).not.toHaveBeenCalled()
    expect(aiViewClient.paste).not.toHaveBeenCalled()
  })

  it('ignores events from the generation that was just destroyed', async () => {
    const controller = makeController('tab-1')
    await controller.attach()

    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))

    await controller.destroy()

    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/late',
      isMainFrame: true
    })

    expect(seen).toEqual([])
    // The URL mirror is frozen too: a late event must not make a destroyed view
    // look like it is sitting on a real conversation.
    expect(controller.getURL?.()).toBe('https://x.test/')
    expect(controller.isDestroyed?.()).toBe(true)
  })

  it('does not replay events buffered before a destroy into the next generation', async () => {
    const controller = makeController('tab-1')
    await controller.attach()
    await controller.destroy()

    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/ghost',
      isMainFrame: true
    })

    const seen: string[] = []
    controller.subscribeEvent?.('did-navigate', (event) => seen.push(event.url))
    aiViewClient.attach.mockResolvedValueOnce(freshAttachResponse(8, 'https://chatgpt.com/c/keep'))
    await controller.attach('https://chatgpt.com/c/keep')

    expect(seen).toEqual([])
  })

  it('re-attaches after a destroy and replays the restored url', async () => {
    // Sleep/wake: the view is destroyed while the tab sleeps and a fresh one is
    // created on wake, and the conversation has to come back. The URL comes from
    // the caller (the panel's per-tab cache), which is the production path.
    const controller = makeController('tab-1')
    await controller.attach()

    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/keep',
      isMainFrame: true
    })

    await controller.destroy()
    expect(controller.isReady?.()).toBe(false)

    aiViewClient.attach.mockResolvedValueOnce(freshAttachResponse(8, 'https://chatgpt.com/c/keep'))
    await expect(controller.attach('https://chatgpt.com/c/keep')).resolves.toBe(true)

    expect(aiViewClient.attach).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewId: 'tab-1', restoredUrl: 'https://chatgpt.com/c/keep' })
    )
    expect(controller.isReady?.()).toBe(true)
    expect(controller.isDestroyed?.()).toBe(false)
    // A freshly attached view is loading again, so nothing injects into it
    // before its document arrives.
    expect(controller.isLoading?.()).toBe(true)
  })

  it('keeps the last url across a destroy so a recreate can resume it', async () => {
    const controller = makeController('tab-1')
    await controller.attach()

    emit({
      viewId: 'tab-1',
      generation: 7,
      kind: 'did-navigate',
      url: 'https://chatgpt.com/c/keep',
      isMainFrame: true
    })
    await controller.destroy()
    expect(controller.getURL?.()).toBe('https://chatgpt.com/c/keep')

    aiViewClient.attach.mockResolvedValueOnce(freshAttachResponse(8, 'https://chatgpt.com/c/keep'))
    await controller.recreate()

    expect(aiViewClient.attach).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewId: 'tab-1', restoredUrl: 'https://chatgpt.com/c/keep' })
    )
    expect(controller.isReady?.()).toBe(true)
  })

  it('reports not-ready even when main never answers the destroy', async () => {
    aiViewClient.destroy.mockReturnValueOnce(new Promise<boolean>(() => {}) as Promise<boolean>)

    const controller = makeController('tab-1')
    await controller.attach()
    void controller.destroy()

    expect(controller.isDestroyed?.()).toBe(true)
    expect(controller.isReady?.()).toBe(false)
  })
})
