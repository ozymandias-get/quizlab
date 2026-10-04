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

beforeEach(() => {
  vi.clearAllMocks()
  aiViewClient.onEvent.mockImplementation((handler: Emitter) => {
    emit = handler
    return () => {}
  })
  aiViewClient.attach.mockResolvedValue({
    generation: 7,
    currentUrl: 'https://x.test/',
    created: true
  })
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

    captured.resolve?.({ generation: 7, currentUrl: 'https://x.test/', created: true })
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

    aiViewClient.attach.mockResolvedValueOnce({
      generation: 8,
      currentUrl: 'https://chatgpt.com/c/keep',
      created: true
    })
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
    aiViewClient.attach.mockResolvedValueOnce({
      generation: 8,
      currentUrl: 'https://x.test/',
      created: true
    })
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
