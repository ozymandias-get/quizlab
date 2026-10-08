import { EventEmitter } from 'node:events'
import type { BrowserWindow, DesktopCapturerSource } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createWindow: vi.fn(),
  ipcMain: new Map<string, (...args: unknown[]) => void>()
}))

vi.mock('electron', () => ({
  BrowserWindow: class {
    constructor(options: unknown) {
      return mocks.createWindow(options)
    }
  },
  ipcMain: {
    on: (channel: string, handler: (...args: unknown[]) => void) => {
      mocks.ipcMain.set(channel, handler)
    },
    removeListener: (channel: string) => mocks.ipcMain.delete(channel)
  }
}))
vi.mock('../../app/window/windows.js', () => ({ resolvePickerIconPath: () => undefined }))
vi.mock('../../core/logger.js', () => ({ Logger: { error: vi.fn() } }))

import { showDisplayMediaPicker } from '../../app/displayMediaPicker.js'

function createWindow() {
  const win = new EventEmitter()
  let destroyed = false
  return Object.assign(win, {
    isDestroyed: () => destroyed,
    webContents: { send: vi.fn() },
    loadURL: vi.fn(() => Promise.resolve()),
    show: vi.fn(),
    close: vi.fn(() => {
      destroyed = true
      win.emit('closed')
    }),
    destroy: vi.fn(() => {
      destroyed = true
      win.emit('closed')
    })
  })
}

describe('display media picker listener lifecycle', () => {
  beforeEach(() => {
    mocks.ipcMain.clear()
    mocks.createWindow.mockReset()
  })

  it.each(['select', 'cancel', 'close', 'load-failure'] as const)(
    'releases the parent closed listener after %s',
    async (outcome) => {
      const parent = createWindow()
      for (let cycle = 0; cycle < 3; cycle++) {
        const picker = createWindow()
        if (outcome === 'load-failure') {
          picker.loadURL.mockRejectedValueOnce(new Error('load failed'))
        }
        mocks.createWindow.mockReturnValueOnce(picker)
        const result = showDisplayMediaPicker(parent as unknown as BrowserWindow, [
          {
            id: 'screen:1',
            name: 'Screen',
            thumbnail: { getSize: () => ({ width: 1, height: 1 }), toDataURL: () => '' }
          } as unknown as DesktopCapturerSource
        ])
        expect(parent.listenerCount('closed')).toBe(1)
        if (outcome === 'select' || outcome === 'cancel') {
          const channel = [...mocks.ipcMain.keys()].find((key) => key.includes(`:${outcome}:`))!
          mocks.ipcMain.get(channel)!({ sender: picker.webContents }, 0)
        } else if (outcome === 'close') {
          picker.close()
        }
        expect(await result).toBe(outcome === 'select' ? 0 : null)
        expect(parent.listenerCount('closed')).toBe(0)
        expect(mocks.ipcMain.size).toBe(0)
      }
    }
  )

  it('destroys and settles a pending picker exactly once when the parent closes', async () => {
    const parent = createWindow()
    const picker = createWindow()
    mocks.createWindow.mockReturnValueOnce(picker)
    const result = showDisplayMediaPicker(parent as unknown as BrowserWindow, [])
    parent.emit('closed')
    expect(await result).toBeNull()
    expect(picker.destroy).toHaveBeenCalledTimes(1)
    expect(parent.listenerCount('closed')).toBe(0)
    expect(mocks.ipcMain.size).toBe(0)
    parent.emit('closed')
    expect(picker.destroy).toHaveBeenCalledTimes(1)
  })
})
