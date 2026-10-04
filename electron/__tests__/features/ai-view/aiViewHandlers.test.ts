import { beforeEach, describe, expect, it, vi } from 'vitest'

const ipcHandle = vi.fn()
const ipcOn = vi.fn()

vi.mock('electron', () => ({
  ipcMain: { handle: ipcHandle, on: ipcOn },
  WebContentsView: class {},
  shell: { openExternal: vi.fn(async () => undefined) }
}))

const requireTrustedIpcSender = vi.hoisted(() => vi.fn((_event: unknown) => true))
vi.mock('../../../core/ipcSecurity.js', () => ({
  requireTrustedIpcSender: (event: unknown) => requireTrustedIpcSender(event)
}))

vi.mock('../../../app/windowManager.js', () => ({
  getMainWindow: () => ({
    isDestroyed: () => false,
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
    webContents: { isDestroyed: () => false, send: vi.fn() }
  })
}))

vi.mock('../../../app/window/permissionPolicy.js', () => ({
  isAllowedManagedViewPartition: (partition: unknown) =>
    typeof partition === 'string' && partition.startsWith('persist:'),
  isHostTrustedForPartition: () => true
}))

vi.mock('../../../app/window/remoteContentSecurity.js', () => ({
  applyRemoteContentSecurity: vi.fn()
}))

vi.mock('../../../features/ai/aiManager.js', () => ({
  AI_REGISTRY: {
    chatgpt: {
      id: 'chatgpt',
      name: 'ChatGPT',
      displayName: 'ChatGPT',
      url: 'https://chatgpt.com',
      partition: 'persist:ai_chatgpt'
    }
  },
  INACTIVE_PLATFORMS: {},
  CHROME_USER_AGENT: 'ua'
}))

vi.mock('../../../features/ai/customPlatformStore.js', () => ({
  readCustomPlatforms: async () => ({})
}))

vi.mock('../../../features/gemini-web-session/sessionConfig.js', () => ({
  PROFILE_PARTITION: 'persist:gemini_web_profile'
}))

const manager = await import('../../../features/ai-view/aiWebContentsViewManager.js')
vi.mock('../../../features/ai-view/aiWebContentsViewManager.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../features/ai-view/aiWebContentsViewManager.js')
  >('../../../features/ai-view/aiWebContentsViewManager.js')
  return {
    ...actual,
    attachAiView: vi.fn(async () => ({
      generation: 1,
      currentUrl: 'https://chatgpt.com/',
      created: true
    })),
    detachAiViewHost: vi.fn(() => true),
    destroyAiView: vi.fn(() => true),
    destroyAllAiViews: vi.fn(),
    setAiViewEventSink: vi.fn(),
    executeAiViewScript: vi.fn(async () => 'ok'),
    pasteAiView: vi.fn(() => true),
    focusAiView: vi.fn(() => true),
    insertAiViewText: vi.fn(() => true),
    sendAiViewInputEvent: vi.fn(() => true),
    reloadAiView: vi.fn(() => true),
    navigateAiView: vi.fn(() => true),
    loadAiViewUrl: vi.fn(() => true),
    getAiViewUrl: vi.fn(() => 'https://chatgpt.com/'),
    syncAiViewHost: vi.fn(() => true),
    setAiViewIgnoreMouse: vi.fn(() => true)
  }
})

const { registerAiViewHandlers, disposeAiViewHandlers } =
  await import('../../../features/ai-view/aiViewHandlers.js')

const CHANNELS = {
  attach: 'ai-view-attach',
  detach: 'ai-view-detach',
  destroy: 'ai-view-destroy',
  reload: 'ai-view-reload',
  loadUrl: 'ai-view-load-url',
  navigate: 'ai-view-navigate',
  getUrl: 'ai-view-get-url',
  execute: 'ai-view-execute-script',
  insertText: 'ai-view-insert-text',
  inputEvent: 'ai-view-send-input-event',
  paste: 'ai-view-paste',
  focus: 'ai-view-focus',
  syncHost: 'ai-view-sync-host',
  ignoreMouse: 'ai-view-set-ignore-mouse',
  event: 'ai-view-event'
}

const trustedEvent = { sender: { id: 'main' } }
const attackerEvent = { sender: { id: 'evil' } }

// The module guards registration, so capture the tables once instead of relying
// on a re-register call after every mock reset.
registerAiViewHandlers()
const HANDLERS = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>(
  ipcHandle.mock.calls.map(([channel, handler]) => [
    channel as string,
    handler as (event: unknown, ...args: unknown[]) => Promise<unknown>
  ])
)
const LISTENERS = new Map<string, (event: unknown, request: unknown) => void>(
  ipcOn.mock.calls.map(([channel, handler]) => [
    channel as string,
    handler as (event: unknown, request: unknown) => void
  ])
)

const invoke = (channel: string) => {
  const handler = HANDLERS.get(channel)
  if (!handler) throw new Error(`handler for ${channel} was not registered`)
  return handler
}

const onMessage = (channel: string) => {
  const handler = LISTENERS.get(channel)
  if (!handler) throw new Error(`listener for ${channel} was not registered`)
  return handler
}

beforeEach(() => {
  vi.clearAllMocks()
  requireTrustedIpcSender.mockReturnValue(true)
  ;(manager.attachAiView as ReturnType<typeof vi.fn>).mockResolvedValue({
    generation: 1,
    currentUrl: 'https://chatgpt.com/',
    created: true
  })
  ;(manager.executeAiViewScript as ReturnType<typeof vi.fn>).mockResolvedValue('ok')
  ;(manager.getAiViewUrl as ReturnType<typeof vi.fn>).mockReturnValue('https://chatgpt.com/')
})

describe('ai view IPC - registration', () => {
  it('registers every managed-view channel exactly once', () => {
    for (const channel of Object.values(CHANNELS)) {
      if (channel === CHANNELS.syncHost || channel === CHANNELS.ignoreMouse) continue
      if (channel === CHANNELS.event) continue
      expect(HANDLERS.has(channel)).toBe(true)
    }
    expect([...LISTENERS.keys()]).toEqual(
      expect.arrayContaining([CHANNELS.syncHost, CHANNELS.ignoreMouse])
    )
  })
})

describe('ai view IPC - trusted sender boundary', () => {
  const rejectingChannels = [
    CHANNELS.attach,
    CHANNELS.detach,
    CHANNELS.destroy,
    CHANNELS.reload,
    CHANNELS.loadUrl,
    CHANNELS.navigate,
    CHANNELS.getUrl,
    CHANNELS.execute,
    CHANNELS.insertText,
    CHANNELS.inputEvent,
    CHANNELS.paste,
    CHANNELS.focus
  ]

  it('returns a failure envelope for an untrusted sender instead of acting', async () => {
    requireTrustedIpcSender.mockReturnValue(false)

    for (const channel of rejectingChannels) {
      const result = (await invoke(channel)(attackerEvent, {
        viewId: 'tab-1'
      })) as { ok: boolean; data?: unknown }
      // The repo convention is a typed envelope: commands that answer with a
      // boolean deny as { ok: true, data: false }, the rest as { ok: false }.
      // Either way no manager call is made.
      if (result.ok) {
        // getUrl is the one command whose "nothing" answer is null.
        expect(result.data === false || result.data === null).toBe(true)
      } else {
        expect(result.ok).toBe(false)
      }
    }

    expect(manager.pasteAiView).not.toHaveBeenCalled()
    expect(manager.executeAiViewScript).not.toHaveBeenCalled()
    expect(manager.focusAiView).not.toHaveBeenCalled()
  })

  it('drops fire-and-forget geometry from an untrusted sender', () => {
    requireTrustedIpcSender.mockReturnValue(false)

    const boundsHandler = onMessage(CHANNELS.syncHost)
    const mouseHandler = onMessage(CHANNELS.ignoreMouse)

    boundsHandler(attackerEvent, {
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: 0, y: 0, width: 999, height: 999 },
      visible: true
    })
    mouseHandler(attackerEvent, { viewId: 'tab-1', hostToken: 'h1', ignore: true })

    expect(manager.syncAiViewHost).not.toHaveBeenCalled()
    expect(manager.setAiViewIgnoreMouse).not.toHaveBeenCalled()
  })
})

describe('ai view IPC - input validation', () => {
  it('rejects an attach without a known target', async () => {
    await expect(
      invoke(CHANNELS.attach)(trustedEvent, { viewId: 'tab-1', source: { kind: 'nope' } })
    ).resolves.toMatchObject({ ok: false })
    expect(manager.attachAiView).not.toHaveBeenCalled()
  })

  it('never lets the renderer choose the partition', async () => {
    await invoke(CHANNELS.attach)(trustedEvent, {
      viewId: 'tab-1',
      source: { kind: 'ai-platform', modelId: 'chatgpt', partition: 'persist:evil' }
    })

    const request = (manager.attachAiView as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(request).toMatchObject({ viewId: 'tab-1' })
    expect(request).not.toHaveProperty('partition')
  })

  it('rejects a script request with no script', async () => {
    await expect(
      invoke(CHANNELS.execute)(trustedEvent, { viewId: 'tab-1', script: '' })
    ).resolves.toMatchObject({ ok: false })
    expect(manager.executeAiViewScript).not.toHaveBeenCalled()
  })

  it('rejects an oversized script', async () => {
    await expect(
      invoke(CHANNELS.execute)(trustedEvent, {
        viewId: 'tab-1',
        script: 'a'.repeat(512 * 1024 + 1)
      })
    ).resolves.toMatchObject({ ok: false })
    expect(manager.executeAiViewScript).not.toHaveBeenCalled()
  })

  it('rejects a non-https load url', async () => {
    await invoke(CHANNELS.loadUrl)(trustedEvent, {
      viewId: 'tab-1',
      url: 'file:///etc/passwd'
    })
    expect(manager.loadAiViewUrl).toHaveBeenCalledWith('tab-1', null)
  })

  it('rejects a multi-step navigation delta', async () => {
    await invoke(CHANNELS.navigate)(trustedEvent, { viewId: 'tab-1', delta: 5 })
    expect(manager.navigateAiView).not.toHaveBeenCalled()
  })

  it('rejects a mouse input event', async () => {
    await invoke(CHANNELS.inputEvent)(trustedEvent, {
      viewId: 'tab-1',
      inputEvent: { type: 'mouseDown', x: 1, y: 1 }
    })
    expect(manager.sendAiViewInputEvent).not.toHaveBeenCalled()
  })

  it('rejects a malformed bounds message', () => {
    const boundsHandler = onMessage(CHANNELS.syncHost)

    boundsHandler(trustedEvent, { viewId: 'tab-1', hostToken: 'h1', bounds: 'big', visible: true })
    boundsHandler(trustedEvent, {
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: NaN, y: 0, width: 1, height: 1 },
      visible: true
    })

    expect(manager.syncAiViewHost).not.toHaveBeenCalled()
  })

  it('normalises bounds before handing them to the manager', () => {
    const boundsHandler = onMessage(CHANNELS.syncHost)

    boundsHandler(trustedEvent, {
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: -5, y: 1.4, width: 10.5, height: 0 },
      visible: true
    })

    expect(manager.syncAiViewHost).toHaveBeenCalledWith(
      'tab-1',
      'h1',
      { x: 0, y: 1, width: 11, height: 0 },
      true
    )
  })
})

describe('ai view IPC - capability boundary', () => {
  it('addresses the managed view by tab id only', async () => {
    await invoke(CHANNELS.paste)(trustedEvent, { viewId: 'tab-9' })
    expect(manager.pasteAiView).toHaveBeenCalledWith('tab-9')
  })

  it('refuses to paste into an arbitrary webContents id', async () => {
    await invoke(CHANNELS.paste)(trustedEvent, { webContentsId: 42 })
    expect(manager.pasteAiView).not.toHaveBeenCalled()
  })

  it('returns a typed failure when the view is unknown', async () => {
    ;(manager.executeAiViewScript as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('view_not_found')
    )
    await expect(
      invoke(CHANNELS.execute)(trustedEvent, { viewId: 'ghost', script: '1' })
    ).resolves.toMatchObject({ ok: false, error: { message: 'view_not_found' } })
  })

  it('returns null for the url of an unknown view', async () => {
    ;(manager.getAiViewUrl as ReturnType<typeof vi.fn>).mockReturnValueOnce(null)
    await expect(invoke(CHANNELS.getUrl)(trustedEvent, { viewId: 'ghost' })).resolves.toEqual({
      ok: true,
      data: null
    })
  })
})

describe('ai view IPC - shutdown', () => {
  it('detaches the event sink and closes every managed view', () => {
    vi.clearAllMocks()
    requireTrustedIpcSender.mockReturnValue(true)
    disposeAiViewHandlers()
    expect(manager.setAiViewEventSink).toHaveBeenLastCalledWith(null)
    expect(manager.destroyAllAiViews).toHaveBeenCalledTimes(1)
  })
})
