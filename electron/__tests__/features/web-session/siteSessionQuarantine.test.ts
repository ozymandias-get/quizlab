import { mkdtempSync, promises as fs, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ dir: '', pathError: null as Error | null }))

vi.mock('electron', () => ({
  app: {
    getPath: () => {
      if (state.pathError) throw state.pathError
      return state.dir
    }
  }
}))

vi.mock('../../../core/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import {
  clearQuarantineMarker,
  readQuarantineMarker,
  writeQuarantineMarker
} from '../../../features/web-session/siteSessionQuarantine.js'

describe('the quarantine marker', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'site-session-quarantine-'))
    state.dir = tempDir
    state.pathError = null
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('survives as an independent durable record', async () => {
    await expect(writeQuarantineMarker('chatgpt', 'session_restore_failed')).resolves.toBe(true)

    // A second process reads only the file: nothing from the writer's memory.
    await expect(readQuarantineMarker('chatgpt')).resolves.toBe('present')
    await expect(readQuarantineMarker('claude')).resolves.toBe('absent')
  })

  it('is removed by the explicit recovery path', async () => {
    await writeQuarantineMarker('chatgpt', 'session_restore_failed')

    await expect(clearQuarantineMarker('chatgpt')).resolves.toBe(true)

    await expect(readQuarantineMarker('chatgpt')).resolves.toBe('absent')
  })

  it('reports a failed removal instead of claiming the quarantine is gone', async () => {
    const remove = vi
      .spyOn(fs, 'rm')
      .mockRejectedValueOnce(Object.assign(new Error('the file is locked'), { code: 'EPERM' }))
    try {
      await expect(clearQuarantineMarker('chatgpt')).resolves.toBe(false)
    } finally {
      remove.mockRestore()
    }
  })

  it('reports an unreadable marker as unknown instead of absent', async () => {
    // A permission error is not proof that no quarantine exists; only ENOENT
    // may be read as "absent".
    state.pathError = Object.assign(new Error('permission denied'), { code: 'EACCES' })

    await expect(readQuarantineMarker('chatgpt')).resolves.toBe('unknown')
  })

  it('reports a write it could not perform instead of claiming success', async () => {
    // A file where the marker directory should be makes every write fail.
    const blocked = path.join(tempDir, 'blocked')
    writeFileSync(blocked, 'not a directory')
    state.dir = blocked

    await expect(writeQuarantineMarker('chatgpt', 'session_restore_failed')).resolves.toBe(false)
  })
})
