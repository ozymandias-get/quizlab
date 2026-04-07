import { beforeEach, describe, expect, it, vi } from 'vitest'

const setPermissionRequestHandler = vi.fn()
const setPermissionCheckHandler = vi.fn()
const setDisplayMediaRequestHandler = vi.fn()
const onBeforeSendHeaders = vi.fn()
const getSources = vi.fn()
const showDisplayMediaPicker = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null)
  },
  desktopCapturer: {
    getSources
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler,
      setPermissionCheckHandler
    },
    fromPartition: vi.fn(() => ({
      webRequest: {
        onBeforeSendHeaders
      },
      setPermissionRequestHandler,
      setPermissionCheckHandler,
      setDisplayMediaRequestHandler
    }))
  }
}))

vi.mock('../../../app/displayMediaPicker', () => ({
  showDisplayMediaPicker
}))

describe('window/sessions', () => {
  beforeEach(() => {
    vi.resetModules()
    setPermissionRequestHandler.mockReset()
    setPermissionCheckHandler.mockReset()
    setDisplayMediaRequestHandler.mockReset()
    onBeforeSendHeaders.mockReset()
    getSources.mockReset()
    showDisplayMediaPicker.mockReset()
  })

  it('configures permissions and display media handler', async () => {
    getSources.mockResolvedValue([
      { id: 'screen:1', name: 'Display 1' },
      { id: 'window:1', name: 'Window 1' }
    ])
    showDisplayMediaPicker.mockResolvedValue(1)
    const module = await import('../../../app/window/sessions')

    module.setupSessions(() => ({}) as never)

    expect(setPermissionRequestHandler).toHaveBeenCalled()
    expect(setPermissionCheckHandler).toHaveBeenCalled()
    expect(setDisplayMediaRequestHandler).toHaveBeenCalled()

    const displayHandler = setDisplayMediaRequestHandler.mock.calls.at(-1)?.[0]
    const callback = vi.fn()
    displayHandler({ videoRequested: true }, callback)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(callback).toHaveBeenCalledWith({
      video: { id: 'window:1', name: 'Window 1' }
    })
  })
})
