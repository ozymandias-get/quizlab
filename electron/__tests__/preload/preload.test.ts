import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '@shared-core/constants/ipc-channels'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld
  },
  ipcRenderer: {
    invoke,
    on,
    removeListener
  }
}))

type ExposedApi = {
  automation: {
    generateAutoSendScript: (
      config: Record<string, unknown>,
      text: string,
      submit: boolean,
      append?: boolean
    ) => Promise<string | null>
    generatePickerScript: (translations: Record<string, string>) => Promise<string | null>
  }
  onTriggerScreenshot: (callback: (type: 'selection' | 'window' | 'screen') => void) => () => void
  onPdfViewerZoom: (callback: (action: 'in' | 'out' | 'reset') => void) => () => void
}

describe('preload electronAPI', () => {
  beforeEach(() => {
    vi.resetModules()
    exposeInMainWorld.mockReset()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    invoke.mockResolvedValue('ok-script')
  })

  it('exposes electronAPI and forwards automation invoke args', async () => {
    await import('../../preload/index.js')

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.any(Object))

    const api = exposeInMainWorld.mock.calls[0]?.[1] as ExposedApi
    const config = { input: '#prompt', button: '#send' }

    await api.automation.generateAutoSendScript(config, 'hello', false, true)
    await api.automation.generatePickerScript({ pickInput: 'Pick input' })
    await api.automation.generateAutoSendScript(config, 'hello-2', true)

    expect(invoke).toHaveBeenNthCalledWith(
      1,
      IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
      'generateAutoSendScript',
      config,
      'hello',
      false,
      true
    )
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
      'generatePickerScript',
      { pickInput: 'Pick input' }
    )
    expect(invoke).toHaveBeenNthCalledWith(
      3,
      IPC_CHANNELS.GET_AUTOMATION_SCRIPTS,
      'generateAutoSendScript',
      config,
      'hello-2',
      true,
      false
    )
  })

  it('subscribes and unsubscribes trigger screenshot events', async () => {
    await import('../../preload/index.js')
    const api = exposeInMainWorld.mock.calls[0]?.[1] as ExposedApi
    const callback = vi.fn()

    const unsubscribe = api.onTriggerScreenshot(callback)

    expect(on).toHaveBeenCalledWith(IPC_CHANNELS.TRIGGER_SCREENSHOT, expect.any(Function))

    const handler = on.mock.calls[0]?.[1] as
      | ((event: unknown, type: 'selection') => void)
      | undefined
    handler?.({}, 'selection')
    expect(callback).toHaveBeenCalledWith('selection')

    unsubscribe()
    expect(removeListener).toHaveBeenCalledWith(IPC_CHANNELS.TRIGGER_SCREENSHOT, handler)
  })

  it('subscribes and unsubscribes pdf viewer zoom events', async () => {
    await import('../../preload/index.js')
    const api = exposeInMainWorld.mock.calls[0]?.[1] as ExposedApi
    const callback = vi.fn()

    const unsubscribe = api.onPdfViewerZoom(callback)

    expect(on).toHaveBeenCalledWith(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, expect.any(Function))

    const handler = on.mock.calls[0]?.[1] as ((event: unknown, action: 'in') => void) | undefined
    handler?.({}, 'in')
    expect(callback).toHaveBeenCalledWith('in')

    unsubscribe()
    expect(removeListener).toHaveBeenCalledWith(IPC_CHANNELS.TRIGGER_PDF_VIEWER_ZOOM, handler)
  })
})
