import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GOOGLE_WEB_SESSION_REGISTRY_IDS } from '../../../../shared/constants/google-ai-web-apps.js'
import {
  sanitizeEnabledAppIds,
  SessionMetadataRepository
} from '../../../features/gemini-web-session/sessionMetadataRepository.js'

describe('sanitizeEnabledAppIds', () => {
  it('falls back to all registry ids when value is not an array', () => {
    expect(sanitizeEnabledAppIds(undefined)).toEqual([...GOOGLE_WEB_SESSION_REGISTRY_IDS])
    expect(sanitizeEnabledAppIds('invalid')).toEqual([...GOOGLE_WEB_SESSION_REGISTRY_IDS])
  })

  it('keeps only valid unique app ids in original order', () => {
    const [first] = GOOGLE_WEB_SESSION_REGISTRY_IDS
    const second = GOOGLE_WEB_SESSION_REGISTRY_IDS[1] ?? first
    const result = sanitizeEnabledAppIds([first, 'invalid', second, first, 12, null])
    expect(result).toEqual([first, second])
  })
})

describe('SessionMetadataRepository', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gws-metadata-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns a sanitized default status when the underlying store is empty', async () => {
    const repository = new SessionMetadataRepository(join(tmpDir, 'session.json'))
    const metadata = await repository.readMetadata()
    expect(metadata.state).toBe('uninitialized')
    expect(metadata.featureEnabled).toBe(true)
    expect(metadata.enabled).toBe(true)
    expect(metadata.enabledAppIds).toEqual([...GOOGLE_WEB_SESSION_REGISTRY_IDS])
  })

  it('drops invalid state and reason codes from the underlying store', async () => {
    const configPath = join(tmpDir, 'session.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        state: 'totally_invalid',
        reasonCode: 'totally_invalid',
        consecutiveFailures: 'not-a-number',
        enabled: true,
        enabledAppIds: ['gemini', 'unknown-app']
      })
    )
    const repository = new SessionMetadataRepository(configPath)
    const metadata = await repository.readMetadata()
    expect(metadata.state).toBe('uninitialized')
    expect(metadata.reasonCode).toBe('none')
    expect(metadata.consecutiveFailures).toBe(0)
    expect(metadata.enabledAppIds).toEqual(['gemini'])
  })

  it('returns error_gws_disabled result when user has disabled the session', async () => {
    const repository = new SessionMetadataRepository(join(tmpDir, 'session.json'))
    const metadata = {
      accountHash: null,
      state: 'uninitialized',
      lastHealthyAt: null,
      lastCheckAt: null,
      consecutiveFailures: 0,
      reasonCode: 'none',
      featureEnabled: true,
      enabled: false,
      enabledAppIds: [...GOOGLE_WEB_SESSION_REGISTRY_IDS]
    } as never
    const result = repository.getDisabledActionResult(metadata)
    expect(result).not.toBeNull()
    expect(result?.success).toBe(false)
    expect(result?.error).toBe('error_gws_disabled')
    expect(result?.status.featureEnabled).toBe(true)
    expect(result?.status.enabled).toBe(false)
  })
})
