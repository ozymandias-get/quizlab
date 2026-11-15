import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => os.tmpdir()) }
}))

vi.mock('../../../core/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import {
  BRIDGE_ENVIRONMENT_FILE,
  claimBridgeEnvironment
} from '../../../features/native-messaging/nativeMessagingEnvironment.js'

describe('the bridge environment of a user data folder', () => {
  let userDataPath: string

  beforeEach(async () => {
    userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'quizlab-env-'))
  })

  async function marker(): Promise<{ environment: string }> {
    return JSON.parse(
      await fs.readFile(path.join(userDataPath, BRIDGE_ENVIRONMENT_FILE), 'utf-8')
    ) as { environment: string }
  }

  it('claims a fresh folder for the running environment', async () => {
    await expect(claimBridgeEnvironment('dev', userDataPath)).resolves.toEqual({ ok: true })
    expect((await marker()).environment).toBe('dev')
  })

  it('accepts the same environment on the next start', async () => {
    await claimBridgeEnvironment('prod', userDataPath)

    await expect(claimBridgeEnvironment('prod', userDataPath)).resolves.toEqual({ ok: true })
    expect((await marker()).environment).toBe('prod')
  })

  it('refuses a folder that belongs to the other environment', async () => {
    await claimBridgeEnvironment('prod', userDataPath)

    // A shared QUIZLAB_USER_DATA_DIR would otherwise hand the release pairing
    // secret and the Chrome profile selection to the development build.
    await expect(claimBridgeEnvironment('dev', userDataPath)).resolves.toEqual({
      ok: false,
      owner: 'prod'
    })
    expect((await marker()).environment).toBe('prod')
  })

  it('claims a folder whose marker cannot be read', async () => {
    await fs.writeFile(path.join(userDataPath, BRIDGE_ENVIRONMENT_FILE), 'not json', 'utf-8')

    await expect(claimBridgeEnvironment('dev', userDataPath)).resolves.toEqual({ ok: true })
    expect((await marker()).environment).toBe('dev')
  })
})
