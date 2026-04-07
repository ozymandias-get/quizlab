import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigManager } from '@electron/core/ConfigManager'

type CounterConfig = { count: number }

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('ConfigManager write serialization', () => {
  it('serializes concurrent updates without losing writes', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cfg-manager-'))
    tempDirs.push(tempDir)
    const filePath = path.join(tempDir, 'config.json')
    const manager = new ConfigManager<CounterConfig>(filePath)

    await manager.write({ count: 0 })

    await Promise.all(
      Array.from({ length: 20 }, () =>
        manager.update((current) => ({
          count: current.count + 1
        }))
      )
    )

    const result = await manager.read(true)
    expect(result.count).toBe(20)
  })
})
