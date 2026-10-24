import type { AiContentController } from '@shared-core/types/aiContent'

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { useManagedContentView } = await import('@shared/hooks/aiContent/useManagedContentView')

/** Attach response for a view main has just created: entry load still in flight. */
const freshAttachResponse = (generation = 1, currentUrl = 'https://x.test/') => ({
  generation,
  currentUrl,
  isLoading: true,
  hasLoadedOnce: false,
  error: null
})

/**
 * Attach response for a view that already finished loading — the shape a
 * focus-mode handoff and a tab returning from behind an overlay actually receive.
 */
const settledAttachResponse = (generation = 1, currentUrl = 'https://x.test/') => ({
  generation,
  currentUrl,
  isLoading: false,
  hasLoadedOnce: true,
  error: null
})

const aiViewClient = vi.hoisted(() => ({
  attach: vi.fn(),
  detach: vi.fn(async () => true),
  destroy: vi.fn(async () => true),
  reload: vi.fn(async () => true),
  loadUrl: vi.fn(async () => true),
  navigate: vi.fn(async () => true),
  getUrl: vi.fn(async () => 'https://x.test/'),
  executeScript: vi.fn(async () => 'ok'),
  insertText: vi.fn(async () => true),
  sendInputEvent: vi.fn(async () => true),
  paste: vi.fn(async () => true),
  focus: vi.fn(async () => true),
  syncHost: vi.fn(),
  onEvent: vi.fn((_handler: (event: unknown) => void) => () => {})
}))

const electronApi = vi.hoisted(() => ({ aiView: aiViewClient }))
vi.mock('@shared/lib/electronApi', () => ({ getElectronApi: () => electronApi }))

vi.mock('@shared/lib/logger', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  reportSuppressedError: vi.fn()
}))

vi.mock('@app/providers', () => ({
  useToastActions: () => ({ showWarning: vi.fn(), showError: vi.fn() })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

const baseOptions = {
  viewId: 'tab-1',
  source: { kind: 'ai-platform' as const, modelId: 'chatgpt' },
  modelId: 'chatgpt',
  // The hook takes its warning reporter as a port instead of reaching for the
  // toast provider itself, so the test supplies the reporter directly.
  showWarning: vi.fn(),
  isEnabled: true,
  isHostOwner: true,
  visible: true
}

const HOST_RECT = { left: 12, top: 20, width: 300, height: 400 }

function createHostElement(): HTMLDivElement {
  return {
    getBoundingClientRect: () => ({
      ...HOST_RECT,
      right: HOST_RECT.left + HOST_RECT.width,
      bottom: HOST_RECT.top + HOST_RECT.height,
      x: HOST_RECT.left,
      y: HOST_RECT.top,
      toJSON: () => ({})
    })
  } as unknown as HTMLDivElement
}

/** Mounts the hook with a real host element so geometry actually syncs. */
async function mount(options = {}, attachHost = true) {
  const utils = renderHook(
    (props: Parameters<typeof useManagedContentView>[0]) => useManagedContentView(props),
    { initialProps: { ...baseOptions, ...options } }
  )

  if (attachHost) {
    act(() => {
      utils.result.current.setHostElement(createHostElement())
    })
  }
  await act(async () => {
    await Promise.resolve()
  })

  return utils
}

const lastSync = () => aiViewClient.syncHost.mock.calls.at(-1)?.[0]

describe('useManagedContentView - view lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiViewClient.attach.mockResolvedValue(freshAttachResponse())
    aiViewClient.onEvent.mockImplementation(() => () => {})
  })

  it('creates exactly one managed view per mount', async () => {
    const { rerender } = await mount()
    rerender({ ...baseOptions })

    expect(aiViewClient.attach).toHaveBeenCalledTimes(1)
    expect((aiViewClient.attach.mock.calls[0] as unknown[])[0]).toMatchObject({
      viewId: 'tab-1',
      source: { kind: 'ai-platform', modelId: 'chatgpt' }
    })
  })

  it('releases the host on unmount but keeps the view alive', async () => {
    const { unmount } = await mount({ isHostOwner: false })
    unmount()

    expect(aiViewClient.detach).toHaveBeenCalledWith({
      viewId: 'tab-1',
      hostToken: expect.any(String)
    })
    expect(aiViewClient.destroy).not.toHaveBeenCalled()
  })

  it('destroys the view when it is disabled (sleep / cold unmount)', async () => {
    const { rerender } = renderHook(
      (props: { isEnabled: boolean }) => useManagedContentView({ ...baseOptions, ...props }),
      { initialProps: { isEnabled: true } }
    )
    await act(async () => {
      await Promise.resolve()
    })

    rerender({ isEnabled: false })

    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'tab-1' })
  })

  it('reuses the same view on a surface remount instead of reloading', async () => {
    const first = await mount()
    first.unmount()
    await mount()

    expect(aiViewClient.reload).not.toHaveBeenCalled()
    expect(aiViewClient.loadUrl).not.toHaveBeenCalled()
    expect(aiViewClient.attach).toHaveBeenCalledTimes(2)
  })

  it('hands the same generation to the next surface after a focus-mode handoff', async () => {
    // The focus overlay mounts its own host placeholder for a view the workspace
    // already owns. That must be a reposition of the *same* WebContents: the
    // manager answers the second attach with the existing generation, and the
    // dead host only releases its claim.
    const generations = new Map<string, number>()
    let counter = 0
    aiViewClient.attach.mockImplementation(async (...args: unknown[]) => {
      const viewId = (args[0] as { viewId: string }).viewId
      const existing = generations.get(viewId)
      if (existing !== undefined) return settledAttachResponse(existing, 'https://chatgpt.com/c/1')
      counter += 1
      generations.set(viewId, counter)
      return freshAttachResponse(counter, 'https://chatgpt.com/c/1')
    })

    const workspace = await mount()
    const workspaceToken = (lastSync()?.hostToken ?? '') as string
    workspace.unmount()

    await mount()

    expect(aiViewClient.destroy).not.toHaveBeenCalled()
    expect(aiViewClient.reload).not.toHaveBeenCalled()
    expect(aiViewClient.loadUrl).not.toHaveBeenCalled()
    // The overlay's placeholder claims the view with a token of its own.
    const focusToken = (lastSync()?.hostToken ?? '') as string
    expect(focusToken).not.toBe('')
    expect(focusToken === workspaceToken).toBe(false)
    expect(generations.size).toBe(1)
  })

  it('destroys the view on a real content close, not on a host swap', async () => {
    // `isEnabled: false` is the lifecycle owner's signal (sleep, api-chat, no
    // site); unmount is only the host owner's, so the two must not be confused.
    const { rerender, unmount } = await mount()
    expect(aiViewClient.destroy).not.toHaveBeenCalled()

    rerender({ ...baseOptions, isEnabled: false })
    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'tab-1' })

    unmount()
    expect(aiViewClient.destroy).toHaveBeenCalledTimes(1)
  })

  it('exposes a reload that goes through the managed view', async () => {
    const { result } = await mount()
    act(() => {
      result.current.reload()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(aiViewClient.reload).toHaveBeenCalledWith({ viewId: 'tab-1' })
  })
})

describe('useManagedContentView - native visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiViewClient.attach.mockResolvedValue(freshAttachResponse())
    aiViewClient.onEvent.mockImplementation(() => () => {})
  })

  it('publishes the host geometry once the view is loaded', async () => {
    await mount()
    expect(lastSync()).toMatchObject({
      viewId: 'tab-1',
      hostToken: expect.any(String),
      bounds: { x: 12, y: 20, width: 300, height: 400 },
      visible: true
    })
  })

  it('keeps the native view hidden until its first load completes', async () => {
    const sink: { emit: ((event: unknown) => void) | null } = { emit: null }
    aiViewClient.onEvent.mockImplementation((handler: (event: unknown) => void) => {
      sink.emit = handler
      return () => {}
    })

    const { result } = await mount({ revealAfterFirstLoad: true })
    expect(result.current.hasLoadedOnce).toBe(false)
    expect(lastSync()?.visible).toBe(false)

    await act(async () => {
      sink.emit?.({
        viewId: 'tab-1',
        generation: 1,
        kind: 'did-stop-loading',
        currentUrl: 'https://x/'
      })
    })

    expect(result.current.hasLoadedOnce).toBe(true)
    expect(lastSync()?.visible).toBe(true)
  })

  it('hides the native view while a fatal error is displayed over it', async () => {
    const sink: { emit: ((event: unknown) => void) | null } = { emit: null }
    aiViewClient.onEvent.mockImplementation((handler: (event: unknown) => void) => {
      sink.emit = handler
      return () => {}
    })

    const { result } = await mount({ hideWhenError: true })
    expect(lastSync()?.visible).toBe(true)

    await act(async () => {
      sink.emit?.({
        viewId: 'tab-1',
        generation: 1,
        kind: 'did-fail-load',
        errorCode: -6,
        errorDescription: 'boom',
        currentUrl: 'https://x.test/'
      })
    })

    expect(result.current.error).toBe('boom')
    expect(lastSync()?.visible).toBe(false)
  })

  it('never publishes geometry from a host that does not own the view', async () => {
    await mount({ isHostOwner: false })
    expect(aiViewClient.syncHost).not.toHaveBeenCalled()
  })
})

describe('useManagedContentView - controller exposure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiViewClient.onEvent.mockImplementation(() => () => {})
  })

  it('hands the managed controller to the messaging layer', async () => {
    const registerContent = vi.fn()
    await mount({ registerContent })
    const controller = registerContent.mock.calls[0][0] as AiContentController

    await controller.executeJavaScript('document.readyState')
    expect(aiViewClient.executeScript).toHaveBeenCalledWith({
      viewId: 'tab-1',
      script: 'document.readyState'
    })
  })
})

/**
 * The host placeholder outlives the `WebContentsView` it positions, so a sleep /
 * wake and a crash recovery each hand it a *different* view under the same view
 * id. Everything the panel knows about "has this guest painted" therefore belongs
 * to a generation, and none of it may survive into the next one.
 */
describe('useManagedContentView - a replacement WebContents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiViewClient.attach.mockResolvedValue(freshAttachResponse())
    aiViewClient.onEvent.mockImplementation(() => () => {})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  type ManagedOptions = Parameters<typeof useManagedContentView>[0]

  interface Mounted {
    result: { current: ReturnType<typeof useManagedContentView> }
    rerender: (props: ManagedOptions) => void
  }

  const generations = (...values: number[]) => {
    const queue = [...values]
    aiViewClient.attach.mockImplementation(async () => freshAttachResponse(queue.shift() ?? 1))
  }

  const captureEvents = () => {
    const sink: { emit: ((event: unknown) => void) | null } = { emit: null }
    aiViewClient.onEvent.mockImplementation((handler: (event: unknown) => void) => {
      sink.emit = handler
      return () => {}
    })
    return sink
  }

  const mountWithEvents = async (options: Partial<ManagedOptions> = {}) => {
    const sink = captureEvents()
    const utils = renderHook((props: ManagedOptions) => useManagedContentView(props), {
      initialProps: { ...baseOptions, revealAfterFirstLoad: true, ...options } as ManagedOptions
    })
    act(() => {
      utils.result.current.setHostElement(createHostElement())
    })
    await act(async () => {
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
    })
    return { ...utils, sink } as Mounted & { sink: typeof sink }
  }

  const settle = async (
    sink: { emit: ((event: unknown) => void) | null },
    generation: number
  ): Promise<void> => {
    await act(async () => {
      sink.emit?.({
        viewId: 'tab-1',
        generation,
        kind: 'did-stop-loading',
        currentUrl: 'https://x/'
      })
    })
  }

  it('starts the replacement view behind the splash after a crash', async () => {
    vi.useFakeTimers()
    generations(5, 6)
    const host = await mountWithEvents({ restoredUrl: 'https://x.test/c/keep' })

    expect(host.result.current.hasLoadedOnce).toBe(false)
    expect(lastSync()?.visible).toBe(false)

    // Generation 5 paints, so the panel reveals it and the crash has something to
    // take away.
    await settle(host.sink, 5)
    expect(host.result.current.hasLoadedOnce).toBe(true)
    expect(lastSync()?.visible).toBe(true)

    await act(async () => {
      host.sink.emit?.({
        viewId: 'tab-1',
        generation: 5,
        kind: 'render-process-gone',
        reason: 'crashed',
        exitCode: 9
      })
      vi.advanceTimersByTime(1000)
    })
    await act(async () => {
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
    })

    // A replacement is a new WebContents with a new generation, and the
    // conversation is replayed into it.
    expect(aiViewClient.attach).toHaveBeenCalledTimes(2)
    expect(aiViewClient.attach).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewId: 'tab-1', restoredUrl: 'https://x.test/c/keep' })
    )
    expect(host.result.current.hasLoadedOnce).toBe(false)
    expect(host.result.current.isLoading).toBe(true)
    expect(lastSync()?.visible).toBe(false)

    // The crashed view is gone: its late events must not settle the replacement.
    await settle(host.sink, 5)
    expect(host.result.current.hasLoadedOnce).toBe(false)
    expect(lastSync()?.visible).toBe(false)

    await settle(host.sink, 6)
    expect(host.result.current.hasLoadedOnce).toBe(true)
    expect(lastSync()?.visible).toBe(true)
  })

  it('starts the replacement view behind the splash after a sleep / wake', async () => {
    generations(1, 2)
    const host = await mountWithEvents()

    await settle(host.sink, 1)
    expect(lastSync()?.visible).toBe(true)

    // `isEnabled: false` is a destroy, and re-enabling it builds a new view.
    host.rerender({ ...baseOptions, revealAfterFirstLoad: true, isEnabled: false })
    await act(async () => {
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
    })
    expect(aiViewClient.destroy).toHaveBeenCalledWith({ viewId: 'tab-1' })

    host.rerender({ ...baseOptions, revealAfterFirstLoad: true, isEnabled: true })
    await act(async () => {
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
    })
    await waitFor(() => {
      expect(aiViewClient.attach).toHaveBeenCalledTimes(2)
    })

    expect(host.result.current.hasLoadedOnce).toBe(false)
    expect(host.result.current.isLoading).toBe(true)
    expect(lastSync()?.visible).toBe(false)

    await settle(host.sink, 2)
    expect(lastSync()?.visible).toBe(true)
  })
})

describe('useManagedContentView - host geometry ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiViewClient.attach.mockResolvedValue(freshAttachResponse())
    aiViewClient.onEvent.mockImplementation(() => () => {})
  })

  it('applies geometry published while the manager still had no view for the id', async () => {
    // `syncAiViewHost` drops a message naming a view it does not own yet, and the
    // host dedupes its own sends, so the first geometry can be lost to an attach
    // that is still resolving its target (a custom platform reads its registry off
    // disk). The rectangle has to be re-published once the attach succeeds.
    let release: ((value: ReturnType<typeof freshAttachResponse>) => void) | null = null
    aiViewClient.attach.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )

    const applied: Array<{ visible: boolean }> = []
    let entryExists = false
    aiViewClient.syncHost.mockImplementation((request: { visible: boolean }) => {
      // Mirrors `syncAiViewHost`: a sync for a view main does not own is dropped.
      if (entryExists) applied.push(request)
    })

    await mount({ revealAfterFirstLoad: false })

    expect(aiViewClient.syncHost).toHaveBeenCalled()
    expect(applied).toEqual([])

    entryExists = true
    await act(async () => {
      release?.(freshAttachResponse(1))
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
    })

    await waitFor(() => {
      expect(applied.length).toBeGreaterThan(0)
    })
    expect(applied.at(-1)).toMatchObject({
      bounds: { x: 12, y: 20, width: 300, height: 400 },
      visible: true
    })
  })
})
