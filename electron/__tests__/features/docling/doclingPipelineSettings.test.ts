import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockUserData = { value: '' }

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return mockUserData.value
      return '/tmp'
    }
  }
}))

describe('doclingPipelineSettings sanitizer', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'docling-pipeline-test-'))
    mockUserData.value = tempRoot
    vi.resetModules()
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {})
    vi.resetModules()
  })

  async function loadSettings() {
    return await import('../../../features/docling/doclingPipelineSettings.js')
  }

  it('clamps out-of-range values to the shared limits', async () => {
    const s = await loadSettings()
    const clean = await s.setPipelinePrefs({
      queueMaxSize: 999_999,
      tableBatchSize: 10_000,
      numThreads: -5,
      documentTimeout: 9999,
      imagesScale: 100
    })
    expect(clean.queueMaxSize).toBe(500)
    expect(clean.tableBatchSize).toBe(16)
    // Below-minimum clamps to the minimum, it does not fall back to default
    expect(clean.numThreads).toBe(1)
    expect(clean.documentTimeout).toBe(540)
    // Absurd scale falls back to the default rather than clamping up
    expect(clean.imagesScale).toBe(1)
  })

  it('strips removed/unknown keys such as device (GPU removal)', async () => {
    const s = await loadSettings()
    const clean = await s.setPipelinePrefs({ device: 'cuda' } as never)
    expect('device' in clean).toBe(false)
    const hash = s.pipelinePrefsHash(clean)
    // Hash must be stable across reads and independent of the stale key.
    expect(hash).not.toContain('cuda')
  })

  it('treats NaN and wrong-typed numbers as defaults', async () => {
    const s = await loadSettings()
    const clean = await s.setPipelinePrefs({
      numThreads: Number.NaN,
      ocrBatchSize: '12' as unknown as number,
      layoutBatchSize: Number.POSITIVE_INFINITY
    })
    expect(clean.numThreads).toBe(4)
    expect(clean.ocrBatchSize).toBe(4)
    expect(clean.layoutBatchSize).toBe(4)
  })
})
