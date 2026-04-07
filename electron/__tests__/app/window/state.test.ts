import { beforeEach, describe, expect, it, vi } from 'vitest'

const readMock = vi.fn()
const writeMock = vi.fn()

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock-user-data')
  },
  screen: {
    getDisplayMatching: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }))
  }
}))

vi.mock('../../../core/ConfigManager', () => ({
  ConfigManager: vi.fn().mockImplementation(function () {
    return {
      read: readMock,
      write: writeMock
    }
  })
}))

describe('window/state', () => {
  beforeEach(() => {
    vi.resetModules()
    readMock.mockReset()
    writeMock.mockReset()
  })

  it('normalizes stored values when loading window state', async () => {
    readMock.mockResolvedValue({
      width: 'bad',
      height: 700,
      x: 120,
      y: 'bad',
      isMaximized: true
    })
    const module = await import('../../../app/window/state.js')

    await expect(module.loadWindowState()).resolves.toEqual({
      width: 1400,
      height: 700,
      x: 120,
      y: undefined,
      isMaximized: true
    })
  })

  it('saves current bounds and maximize state', async () => {
    const module = await import('../../../app/window/state.js')
    writeMock.mockResolvedValue(true)
    const mockWindow = {
      isDestroyed: () => false,
      isMaximized: () => false,
      getBounds: () => ({ width: 1111, height: 777, x: 20, y: 30 }),
      getNormalBounds: () => ({ width: 1, height: 1, x: 1, y: 1 })
    } as never

    await module.saveWindowState(mockWindow)

    expect(writeMock).toHaveBeenCalledWith({
      width: 1111,
      height: 777,
      x: 20,
      y: 30,
      isMaximized: false
    })
  })
})
