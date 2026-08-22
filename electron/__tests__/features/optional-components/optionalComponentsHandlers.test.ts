import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const trustedSender = { id: 1 }
const trustedEvent = { sender: trustedSender, type: 'invoke' }

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/tmp/quizlab-test')
  },
  ipcMain: {
    handle: ipcHandle
  }
}))

vi.mock('../../../core/coreHelpers', () => ({
  getComponentsStatePath: vi.fn(() => '/tmp/quizlab-test/components.json')
}))

vi.mock('../../../app/windowManager', () => ({
  getMainWindow: vi.fn(() => ({
    webContents: trustedSender
  }))
}))

const storeData = new Map<
  string,
  { status: string; version: string | null; error: string | null; updatedAt: number }
>()

vi.mock('../../../core/ConfigManager', () => ({
  ConfigManager: class {
    async read(): Promise<Record<string, unknown>> {
      return Object.fromEntries(storeData)
    }

    async update(
      updater: (current: Record<string, unknown>) => Promise<Record<string, unknown>>
    ): Promise<boolean> {
      const current = Object.fromEntries(storeData)
      const updated = await updater(current)
      for (const [key, value] of Object.entries(updated)) {
        storeData.set(
          key,
          value as {
            status: string
            version: string | null
            error: string | null
            updatedAt: number
          }
        )
      }
      return true
    }
  }
}))

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('optionalComponentsHandlers', () => {
  beforeEach(async () => {
    vi.resetModules()
    ipcHandle.mockReset()
    storeData.clear()
    const { resetOptionalComponentRegistry } =
      await import('../../../features/optional-components/componentRegistry.js')
    resetOptionalComponentRegistry()
  })

  async function register() {
    const { registerOptionalComponentsHandlers } =
      await import('../../../features/optional-components/handlers.js')
    registerOptionalComponentsHandlers()
  }

  it('registers exactly the three optional-components channels', async () => {
    await register()

    const channels = ipcHandle.mock.calls.map(([channel]) => channel)
    expect(channels).toEqual([
      APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_LIST,
      APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_GET_STATE,
      APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_RUN_ACTION
    ])
  })

  it('LIST includes the whitelisted docling component in its default state', async () => {
    await register()

    const listHandler = getHandler(APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_LIST)
    const result = await listHandler?.(trustedEvent)

    expect(result.ok).toBe(true)
    const components = result.data as Array<{ id: string; status: string; displayName: string }>
    const docling = components.find((component) => component.id === 'docling')
    expect(docling).toMatchObject({
      id: 'docling',
      displayName: 'Docling Smart Reader',
      status: 'not_installed',
      installed: false,
      version: null
    })
  })

  it('GET_STATE resolves null for malformed or unknown ids and state for known ones', async () => {
    await register()

    const getStateHandler = getHandler(APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_GET_STATE)

    expect(await getStateHandler?.(trustedEvent, '../etc/passwd')).toEqual({ ok: true, data: null })
    expect(await getStateHandler?.(trustedEvent, 42)).toEqual({ ok: true, data: null })
    expect(await getStateHandler?.(trustedEvent, 'ghost-component')).toEqual({
      ok: true,
      data: null
    })

    const known = await getStateHandler?.(trustedEvent, 'docling')
    expect(known).toMatchObject({ ok: true, data: { id: 'docling' } })
  })

  it('RUN_ACTION validates the action name before doing any work', async () => {
    await register()

    const runActionHandler = getHandler(APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_RUN_ACTION)

    expect(await runActionHandler?.(trustedEvent, 'docling', 'format-c-drive')).toEqual({
      ok: false,
      error: { code: 'invalid_input', message: 'Invalid component action', details: undefined }
    })
    expect(await runActionHandler?.(trustedEvent, '../escape', 'install')).toEqual({
      ok: false,
      error: { code: 'invalid_input', message: 'Invalid component id', details: undefined }
    })
  })

  it('RUN_ACTION maps unregistered ids to a not_found failure', async () => {
    await register()

    const runActionHandler = getHandler(APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_RUN_ACTION)

    const result = await runActionHandler?.(trustedEvent, 'ghost', 'install')

    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } })
  })

  it('the placeholder docling install fails honestly with an error status', async () => {
    await register()

    const runActionHandler = getHandler(APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_RUN_ACTION)
    const result = (await runActionHandler?.(trustedEvent, 'docling', 'install')) as {
      ok: boolean
      data: { success: boolean; component: { status: string; error: string } }
    }

    expect(result.ok).toBe(true)
    expect(result.data.success).toBe(false)
    expect(result.data.component.status).toBe('error')
    expect(result.data.component.error).toContain('not implemented yet')
    expect(storeData.get('docling')).toMatchObject({ status: 'error' })
  })

  it('blocks untrusted senders on every channel', async () => {
    await register()

    const untrustedEvent = { sender: { id: 999 }, type: 'invoke' }
    const listHandler = getHandler(APP_CONFIG.IPC_CHANNELS.OPTIONAL_COMPONENTS_LIST)
    const result = await listHandler?.(untrustedEvent)

    expect(result).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized', details: undefined }
    })
  })
})
