import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }))

import { getDirectorySize } from '../../../core/cacheMonitor.js'
import { trimPartitionCache } from '../../../core/cacheCleanup/operations.js'

describe('partition cache trimming', () => {
  it('applies the target to the combined cache directories', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'quizlab-cache-test-'))
    try {
      const partition = path.join(root, 'Partitions', 'ai_test')
      for (const directory of ['Cache', 'Code Cache', 'GPUCache']) {
        const cache = path.join(partition, directory)
        await fs.mkdir(cache, { recursive: true })
        await fs.writeFile(path.join(cache, 'entry'), '0123456789ab')
        await fs.utimes(path.join(cache, 'entry'), new Date(1000), new Date(1000))
      }
      const result = await trimPartitionCache('ai_test', 20, root, 1)
      expect(result.deleted).toBe(2)
      const sizes = await Promise.all(
        ['Cache', 'Code Cache', 'GPUCache'].map((dir) =>
          getDirectorySize(path.join(partition, dir))
        )
      )
      expect(sizes.reduce((sum, size) => sum + size.totalBytes, 0)).toBe(12)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
