import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileLock } from '../../../features/gemini-web-session/profileLock'

const fsMocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  close: vi.fn(),
  open: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn()
}))

vi.mock('fs', () => ({
  default: {
    promises: {
      open: fsMocks.open,
      readFile: fsMocks.readFile,
      rm: fsMocks.rm
    },
    constants: {
      O_CREAT: 64,
      O_EXCL: 128,
      O_RDWR: 2
    }
  },
  promises: {
    open: fsMocks.open,
    readFile: fsMocks.readFile,
    rm: fsMocks.rm
  },
  constants: {
    O_CREAT: 64,
    O_EXCL: 128,
    O_RDWR: 2
  }
}))

vi.mock('../../../features/gemini-web-session/sessionUtils', () => ({
  nowIso: vi.fn(() => '2026-01-01T00:00:00.000Z'),
  isProcessAlive: vi.fn(() => false)
}))

describe('profile lock', () => {
  beforeEach(() => {
    fsMocks.writeFile.mockReset().mockResolvedValue(undefined)
    fsMocks.close.mockReset().mockResolvedValue(undefined)
    fsMocks.open
      .mockReset()
      .mockResolvedValue({ writeFile: fsMocks.writeFile, close: fsMocks.close })
    fsMocks.readFile.mockReset().mockResolvedValue(JSON.stringify({ pid: 999999 }))
    fsMocks.rm.mockReset().mockResolvedValue(undefined)
  })

  it('acquires and releases lock file', async () => {
    const lock = new ProfileLock({
      lockPath: 'C:/tmp/.profile.lock',
      ensureProfileDirectory: async () => undefined
    })

    const acquired = await lock.acquire()
    expect(acquired.ok).toBe(true)
    expect(fsMocks.open).toHaveBeenCalledTimes(1)
    expect(fsMocks.writeFile).toHaveBeenCalledTimes(1)

    await lock.release()
    expect(fsMocks.close).toHaveBeenCalledTimes(1)
    expect(fsMocks.rm).toHaveBeenCalledWith('C:/tmp/.profile.lock', { force: true })
  })

  it('retries when stale lock exists', async () => {
    fsMocks.open
      .mockRejectedValueOnce({ code: 'EEXIST' })
      .mockResolvedValueOnce({ writeFile: fsMocks.writeFile, close: fsMocks.close })

    const lock = new ProfileLock({
      lockPath: 'C:/tmp/.profile.lock',
      ensureProfileDirectory: async () => undefined
    })

    const acquired = await lock.acquire()
    expect(acquired.ok).toBe(true)
    expect(fsMocks.readFile).toHaveBeenCalledTimes(1)
    expect(fsMocks.rm).toHaveBeenCalledWith('C:/tmp/.profile.lock', { force: true })
  })
})
