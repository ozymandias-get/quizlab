import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => state.dir }
}))

vi.mock('../../../core/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { NativeMessagingProfileStore } from '../../../features/native-messaging/nativeMessagingProfiles.js'

const STATE = {
  version: 1 as const,
  selectedProfileId: 'profile-a-1234',
  selectionVersion: 4,
  profiles: [
    { id: 'profile-a-1234', name: 'Ana Chrome' },
    { id: 'profile-b-1234', name: 'İş Chrome' }
  ]
}

describe('the Chrome profile store', () => {
  let tempDir: string
  let filePath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-profiles-'))
    state.dir = tempDir
    filePath = path.join(tempDir, 'bridge-profiles.json')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('returns an empty state only when the file does not exist', async () => {
    const store = new NativeMessagingProfileStore(filePath)

    await expect(store.load()).resolves.toEqual({
      version: 1,
      selectedProfileId: null,
      selectionVersion: 0,
      profiles: []
    })
  })

  it('reads the names and the selection back', async () => {
    await fs.writeFile(filePath, JSON.stringify(STATE), 'utf-8')
    const store = new NativeMessagingProfileStore(filePath)

    await expect(store.load()).resolves.toEqual(STATE)
  })

  it('preserves a corrupt file instead of silently replacing it', async () => {
    await fs.writeFile(filePath, 'not json', 'utf-8')
    const store = new NativeMessagingProfileStore(filePath)

    await expect(store.load()).resolves.toEqual({
      version: 1,
      selectedProfileId: null,
      selectionVersion: 0,
      profiles: []
    })

    const backups = (await fs.readdir(tempDir)).filter((name) =>
      name.startsWith('bridge-profiles.json.corrupt-')
    )
    expect(backups).toHaveLength(1)
    await expect(fs.readFile(path.join(tempDir, backups[0]), 'utf-8')).resolves.toBe('not json')
  })

  it('reports a read error instead of claiming the user has no profiles', async () => {
    // A directory at the path makes readFile fail with a non-ENOENT error.
    await fs.mkdir(filePath)
    const store = new NativeMessagingProfileStore(filePath)

    await expect(store.load()).rejects.toThrow(/could not be read/i)
  })

  it('saves concurrent snapshots through separate temporary files', async () => {
    const first = new NativeMessagingProfileStore(filePath)
    const second = new NativeMessagingProfileStore(filePath)

    await Promise.all([
      first.save(STATE),
      second.save({ ...STATE, selectionVersion: 5, selectedProfileId: 'profile-b-1234' })
    ])

    const stored = JSON.parse(await fs.readFile(filePath, 'utf-8')) as typeof STATE
    expect([4, 5]).toContain(stored.selectionVersion)
    expect(stored.profiles.map((profile) => profile.id).sort()).toEqual([
      'profile-a-1234',
      'profile-b-1234'
    ])
    expect((await fs.readdir(tempDir)).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })
})
