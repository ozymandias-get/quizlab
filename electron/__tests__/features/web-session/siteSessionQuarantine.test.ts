import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

import {
  clearQuarantineMarker,
  hasQuarantineMarker,
  writeQuarantineMarker
} from '../../../features/web-session/siteSessionQuarantine.js'

describe('the quarantine marker', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'site-session-quarantine-'))
    state.dir = tempDir
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('survives as an independent durable record', async () => {
    await expect(writeQuarantineMarker('chatgpt', 'session_restore_failed')).resolves.toBe(true)

    // A second process reads only the file: nothing from the writer's memory.
    await expect(hasQuarantineMarker('chatgpt')).resolves.toBe(true)
    await expect(hasQuarantineMarker('claude')).resolves.toBe(false)
  })

  it('is removed by the explicit recovery path', async () => {
    await writeQuarantineMarker('chatgpt', 'session_restore_failed')

    await clearQuarantineMarker('chatgpt')

    await expect(hasQuarantineMarker('chatgpt')).resolves.toBe(false)
  })

  it('reports a write it could not perform instead of claiming success', async () => {
    // A file where the marker directory should be makes every write fail.
    const blocked = path.join(tempDir, 'blocked')
    writeFileSync(blocked, 'not a directory')
    state.dir = blocked

    await expect(writeQuarantineMarker('chatgpt', 'session_restore_failed')).resolves.toBe(false)
  })
})
