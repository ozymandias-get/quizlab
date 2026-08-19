import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileLock } from '../../../features/gemini-web-session/profileLock.js'

const fsMocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  close: vi.fn(),
  open: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  rename: vi.fn()
}))

const sessionUtilsMocks = vi.hoisted(() => ({
  nowIso: vi.fn(() => '2026-01-01T00:00:00.000Z'),
  isProcessAlive: vi.fn(() => false)
}))

vi.mock('fs', () => ({
  default: {
    promises: {
      open: fsMocks.open,
      readFile: fsMocks.readFile,
      rm: fsMocks.rm,
      rename: fsMocks.rename
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
    rm: fsMocks.rm,
    rename: fsMocks.rename
  },
  constants: {
    O_CREAT: 64,
    O_EXCL: 128,
    O_RDWR: 2
  }
}))

vi.mock('../../../features/gemini-web-session/sessionUtils', () => sessionUtilsMocks)

const handle = () => ({ writeFile: fsMocks.writeFile, close: fsMocks.close })

const eexist = () => Promise.reject(Object.assign(new Error('EEXIST'), { code: 'EEXIST' }))

function makeLock() {
  return new ProfileLock({
    lockPath: '/tmp/quizlab-test/.profile.lock',
    ensureProfileDirectory: async () => undefined
  })
}

describe('profile lock', () => {
  beforeEach(() => {
    vi.useRealTimers()
    fsMocks.writeFile.mockReset().mockResolvedValue(undefined)
    fsMocks.close.mockReset().mockResolvedValue(undefined)
    fsMocks.open.mockReset().mockResolvedValue(handle())
    fsMocks.readFile.mockReset().mockResolvedValue(JSON.stringify({ pid: 999999 }))
    fsMocks.rm.mockReset().mockResolvedValue(undefined)
    fsMocks.rename.mockReset().mockResolvedValue(undefined)
    sessionUtilsMocks.isProcessAlive.mockReset().mockReturnValue(false)
  })

  it('acquires and releases lock file', async () => {
    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired.ok).toBe(true)
    expect(fsMocks.open).toHaveBeenCalledTimes(1)
    expect(fsMocks.writeFile).toHaveBeenCalledTimes(1)

    await lock.release()
    expect(fsMocks.close).toHaveBeenCalledTimes(1)
    expect(fsMocks.rm).toHaveBeenCalledWith('/tmp/quizlab-test/.profile.lock', { force: true })
  })

  it('retries when stale lock exists by atomically renaming it away', async () => {
    fsMocks.open.mockRejectedValueOnce({ code: 'EEXIST' }).mockResolvedValueOnce(handle())

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired.ok).toBe(true)
    expect(fsMocks.readFile).toHaveBeenCalledTimes(1)
    expect(fsMocks.rename).toHaveBeenCalledWith(
      '/tmp/quizlab-test/.profile.lock',
      expect.stringContaining('/tmp/quizlab-test/.profile.lock.stale-')
    )
    expect(fsMocks.rm).toHaveBeenCalledWith(expect.stringContaining('.profile.lock.stale-'), {
      force: true
    })
    expect(fsMocks.rm).not.toHaveBeenCalledWith(
      '/tmp/quizlab-test/.profile.lock',
      expect.anything()
    )
  })

  it('returns already_in_use for a live lock without touching it', async () => {
    sessionUtilsMocks.isProcessAlive.mockReturnValue(true)
    fsMocks.open.mockRejectedValue({ code: 'EEXIST' })
    fsMocks.readFile.mockResolvedValue(JSON.stringify({ pid: 4242 }))

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired).toEqual({ ok: false, error: 'already_in_use' })
    expect(fsMocks.rm).not.toHaveBeenCalled()
    expect(fsMocks.rename).not.toHaveBeenCalled()
  })

  it('does not reclaim a live lock with a fresh heartbeat', async () => {
    sessionUtilsMocks.isProcessAlive.mockReturnValue(true)
    fsMocks.open.mockRejectedValue({ code: 'EEXIST' })
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ pid: 4242, heartbeatAt: new Date().toISOString() })
    )

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired).toEqual({ ok: false, error: 'already_in_use' })
    expect(fsMocks.rm).not.toHaveBeenCalled()
    expect(fsMocks.rename).not.toHaveBeenCalled()
  })

  it('reclaims a lock whose heartbeat went stale (hung holder)', async () => {
    sessionUtilsMocks.isProcessAlive.mockReturnValue(true)
    fsMocks.open.mockRejectedValueOnce({ code: 'EEXIST' }).mockResolvedValueOnce(handle())
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({ pid: 4242, heartbeatAt: '2020-01-01T00:00:00.000Z' })
    )

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired.ok).toBe(true)
    expect(fsMocks.rename).toHaveBeenCalledTimes(1)
  })

  it('does not reclaim a live legacy lock (no timestamps)', async () => {
    sessionUtilsMocks.isProcessAlive.mockReturnValue(true)
    fsMocks.open.mockRejectedValue({ code: 'EEXIST' })
    fsMocks.readFile.mockResolvedValue(JSON.stringify({ pid: 4242 }))

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired).toEqual({ ok: false, error: 'already_in_use' })
    expect(fsMocks.rename).not.toHaveBeenCalled()
  })

  it('refreshes the heartbeat while held and stops on release', async () => {
    vi.useFakeTimers()
    try {
      const lock = makeLock()

      const acquired = await lock.acquire()
      expect(acquired.ok).toBe(true)
      expect(fsMocks.writeFile).toHaveBeenCalledTimes(1)
      const initial = JSON.parse(fsMocks.writeFile.mock.calls[0][0] as string)
      expect(initial.pid).toBe(process.pid)
      expect(initial.heartbeatAt).toBe(sessionUtilsMocks.nowIso())

      vi.advanceTimersByTime(5000)
      expect(fsMocks.writeFile).toHaveBeenCalledTimes(2)
      const refreshed = JSON.parse(fsMocks.writeFile.mock.calls[1][0] as string)
      expect(refreshed.pid).toBe(process.pid)
      expect(refreshed.createdAt).toBe(initial.createdAt)
      expect(typeof refreshed.heartbeatAt).toBe('string')

      await lock.release()
      vi.advanceTimersByTime(10_000)
      expect(fsMocks.writeFile).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('loses the reclaim race without deleting the winners fresh lock', async () => {
    // We lose the atomic rename (someone else already reclaimed the stale lock),
    // then find the winner's new live lock on retry. The old implementation
    // would `rm` the lock path unconditionally and delete the winner's lock.
    fsMocks.open.mockRejectedValueOnce({ code: 'EEXIST' }).mockRejectedValueOnce({ code: 'EEXIST' })
    fsMocks.readFile.mockResolvedValue(JSON.stringify({ pid: 999999 }))
    fsMocks.rename.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired).toEqual({ ok: false, error: 'already_in_use' })
    expect(fsMocks.rm).not.toHaveBeenCalled()
  })

  it('reclaims an unparseable leftover lock after a grace re-read', async () => {
    fsMocks.open.mockRejectedValueOnce({ code: 'EEXIST' }).mockResolvedValueOnce(handle())
    fsMocks.readFile.mockResolvedValue('')

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired.ok).toBe(true)
    expect(fsMocks.readFile).toHaveBeenCalledTimes(2)
    expect(fsMocks.rename).toHaveBeenCalledTimes(1)
  })

  it('reclaims a lock file whose pid is dead', async () => {
    fsMocks.open.mockRejectedValueOnce({ code: 'EEXIST' }).mockResolvedValueOnce(handle())
    fsMocks.readFile.mockResolvedValue(JSON.stringify({ pid: 1 }))

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired.ok).toBe(true)
    expect(fsMocks.rename).toHaveBeenCalledTimes(1)
  })

  it('does not delete a well-formed live lock when read fails transiently', async () => {
    sessionUtilsMocks.isProcessAlive.mockReturnValue(true)
    fsMocks.open.mockRejectedValue({ code: 'EEXIST' })
    fsMocks.readFile.mockRejectedValue(Object.assign(new Error('EIO'), { code: 'EIO' }))

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired).toEqual({ ok: false, error: 'already_in_use' })
    expect(fsMocks.rm).not.toHaveBeenCalled()
    expect(fsMocks.rename).not.toHaveBeenCalled()
  })

  it('returns lock_error and removes the file when writeFile fails after open', async () => {
    fsMocks.writeFile.mockRejectedValue(new Error('disk full'))

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired).toEqual({ ok: false, error: 'lock_error' })
    expect(fsMocks.close).toHaveBeenCalledTimes(1)
    expect(fsMocks.rm).toHaveBeenCalledWith('/tmp/quizlab-test/.profile.lock', { force: true })
  })

  it('treats a missing lock file mid-reclaim as a fresh acquire', async () => {
    fsMocks.open.mockRejectedValueOnce({ code: 'EEXIST' }).mockResolvedValueOnce(handle())
    fsMocks.readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    const lock = makeLock()

    const acquired = await lock.acquire()
    expect(acquired.ok).toBe(true)
    expect(fsMocks.rm).not.toHaveBeenCalled()
  })
})
