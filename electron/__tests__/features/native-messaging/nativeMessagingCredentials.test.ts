import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => state.dir }
}))

import { NativeMessagingCredentials } from '../../../features/native-messaging/nativeMessagingCredentials.js'

describe('the bridge pairing secret', () => {
  let tempDir: string
  let secretPath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-secret-'))
    state.dir = tempDir
    secretPath = path.join(tempDir, 'bridge-secret.json')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('creates one secret when the file is missing', async () => {
    const secret = await NativeMessagingCredentials.loadOrCreateSharedSecret()

    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    await expect(fs.readFile(secretPath, 'utf-8')).resolves.toContain(secret)
  })

  it('reuses the persisted secret without rewriting it', async () => {
    const persisted = 'a'.repeat(64)
    await fs.writeFile(secretPath, JSON.stringify({ secret: persisted }), 'utf-8')
    const before = (await fs.stat(secretPath)).mtimeMs

    await expect(NativeMessagingCredentials.loadOrCreateSharedSecret()).resolves.toBe(persisted)
    expect((await fs.stat(secretPath)).mtimeMs).toBe(before)
  })

  it('lets concurrent callers create exactly one persistent secret', async () => {
    const secrets = await Promise.all([
      NativeMessagingCredentials.loadOrCreateSharedSecret(),
      NativeMessagingCredentials.loadOrCreateSharedSecret(),
      NativeMessagingCredentials.loadOrCreateSharedSecret()
    ])

    expect(new Set(secrets).size).toBe(1)
    const stored = JSON.parse(await fs.readFile(secretPath, 'utf-8')) as { secret: string }
    expect(stored.secret).toBe(secrets[0])
  })

  it('does not reset a corrupt secret', async () => {
    await fs.writeFile(secretPath, 'not a secret', 'utf-8')

    await expect(NativeMessagingCredentials.loadOrCreateSharedSecret()).rejects.toThrow(
      /invalid|refusing/i
    )
    await expect(fs.readFile(secretPath, 'utf-8')).resolves.toBe('not a secret')
  })

  it('does not reset a secret it cannot read', async () => {
    // A directory at the path makes readFile fail with a non-ENOENT error.
    await fs.mkdir(secretPath)

    await expect(NativeMessagingCredentials.loadOrCreateSharedSecret()).rejects.toThrow(
      /could not be read/i
    )
    expect((await fs.stat(secretPath)).isDirectory()).toBe(true)
  })
})
