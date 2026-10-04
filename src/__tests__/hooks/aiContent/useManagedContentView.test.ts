import type { AiContentController } from '@shared-core/types/aiContent'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useManagedContentView } = await import('@shared/hooks/aiContent/useManagedContentView')

const aiViewClient = vi.hoisted(() => ({
  attach: vi.fn(async () => ({ generation: 1, currentUrl: 'https://x.test/', created: true })),
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
    aiViewClient.attach.mockResolvedValue({
      generation: 1,
      currentUrl: 'https://x.test/',
      created: true
    })
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
      if (existing !== undefined) {
        return { generation: existing, currentUrl: 'https://chatgpt.com/c/1', created: false }
      }
      counter += 1
      generations.set(viewId, counter)
      return { generation: counter, currentUrl: 'https://chatgpt.com/c/1', created: true }
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
    aiViewClient.attach.mockResolvedValue({
      generation: 1,
      currentUrl: 'https://x.test/',
      created: true
    })
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
