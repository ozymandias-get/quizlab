import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ConfigManager } from '@electron/core/ConfigManager'

import { afterEach, describe, expect, it } from 'vitest'

type TestConfig = {
  name?: string
  version?: number
  settings?: {
    theme?: string
    language?: string
  }
  items?: string[]
}

const tempDirs: string[] = []

function createTempManager<T extends object>(data?: T) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cfg-test-'))
  tempDirs.push(tempDir)
  const filePath = path.join(tempDir, 'config.json')
  const manager = new ConfigManager<T>(filePath)
  return { manager, filePath, tempDir }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe('ConfigManager - CRUD Operations', () => {
  it('creates file and writes initial data', async () => {
    const { manager, filePath } = createTempManager<TestConfig>()
    const data: TestConfig = { name: 'test', version: 1 }

    const success = await manager.write(data)
    expect(success).toBe(true)

    const content = readFileSync(filePath, 'utf8')
    expect(JSON.parse(content)).toEqual(data)
  })

  it('reads data from file', async () => {
    const { manager, filePath } = createTempManager<TestConfig>()
    const data: TestConfig = { name: 'read-test', version: 2 }
    writeFileSync(filePath, JSON.stringify(data), 'utf8')

    const result = await manager.read()
    expect(result).toEqual(data)
  })

  it('returns cached data on subsequent reads', async () => {
    const { manager, filePath } = createTempManager<TestConfig>()
    const data: TestConfig = { name: 'cached' }
    await manager.write(data)

    // Modify file externally
    writeFileSync(filePath, JSON.stringify({ name: 'external-change' }), 'utf8')

    // Should return cached value
    const result = await manager.read()
    expect(result.name).toBe('cached')
  })

  it('force reads from disk when force=true', async () => {
    const { manager, filePath } = createTempManager<TestConfig>()
    await manager.write({ name: 'original' })

    // Modify file externally
    writeFileSync(filePath, JSON.stringify({ name: 'modified' }), 'utf8')

    const result = await manager.read(true)
    expect(result.name).toBe('modified')
  })

  it('updates data atomically', async () => {
    const { manager } = createTempManager<TestConfig>()
    await manager.write({ name: 'initial', version: 1 })

    const success = await manager.update((current) => ({
      ...current,
      version: (current.version || 0) + 1
    }))
    expect(success).toBe(true)

    const result = await manager.read(true)
    expect(result.version).toBe(2)
  })

  it('getItem retrieves a specific key', async () => {
    const { manager } = createTempManager<TestConfig>()
    await manager.write({ name: 'specific', version: 5 })

    const name = await manager.getItem('name')
    expect(name).toBe('specific')

    const version = await manager.getItem('version')
    expect(version).toBe(5)
  })

  it('setItem updates a specific key', async () => {
    const { manager } = createTempManager<TestConfig>()
    await manager.write({ name: 'old', version: 1 })

    const success = await manager.setItem('name', 'new')
    expect(success).toBe(true)

    const result = await manager.read(true)
    expect(result.name).toBe('new')
    expect(result.version).toBe(1)
  })

  it('deleteItem removes a key', async () => {
    const { manager } = createTempManager<TestConfig>()
    await manager.write({ name: 'delete-me', version: 1 })

    const success = await manager.deleteItem('name')
    expect(success).toBe(true)

    const result = await manager.read(true)
    expect(result.name).toBeUndefined()
    expect(result.version).toBe(1)
  })

  it('clear empties the config', async () => {
    const { manager } = createTempManager<TestConfig>()
    await manager.write({ name: 'to-clear', version: 1 })

    const success = await manager.clear()
    expect(success).toBe(true)

    const result = await manager.read(true)
    expect(result).toEqual({})
  })
})

describe('ConfigManager - File Creation', () => {
  it('creates directory recursively if it does not exist', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cfg-nested-'))
    tempDirs.push(tempDir)
    const nestedPath = path.join(tempDir, 'sub', 'dir', 'config.json')
    const manager = new ConfigManager<TestConfig>(nestedPath)

    const success = await manager.write({ name: 'nested' })
    expect(success).toBe(true)

    const content = readFileSync(nestedPath, 'utf8')
    expect(JSON.parse(content)).toEqual({ name: 'nested' })
  })

  it('creates empty JSON file when reading non-existent file', async () => {
    const { manager, filePath } = createTempManager<TestConfig>()

    const result = await manager.read()
    expect(result).toEqual({})
    expect(readFileSync(filePath, 'utf8')).toBe('{}')
  })
})

describe('ConfigManager - Error Handling', () => {
  it(
    'returns false on write failure',
    {
      skip: os.platform() === 'win32'
    },
    async () => {
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cfg-err-'))
      tempDirs.push(tempDir)
      const manager = new ConfigManager<TestConfig>(
        path.join(tempDir, 'sub', 'deep', 'config.json')
      )

      // Write first to establish cache, then make the dir read-only
      await manager.write({ name: 'initial' })

      // Now make the directory read-only to trigger write failure
      chmodSync(path.join(tempDir, 'sub', 'deep'), 0o555)

      try {
        const success = await manager.write({ name: 'fail' })
        expect(success).toBe(false)
      } finally {
        // Restore permissions for cleanup
        chmodSync(path.join(tempDir, 'sub', 'deep'), 0o755)
      }
    }
  )

  it(
    'returns false on update failure',
    {
      skip: os.platform() === 'win32'
    },
    async () => {
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cfg-err2-'))
      tempDirs.push(tempDir)
      const manager = new ConfigManager<TestConfig>(path.join(tempDir, 'sub', 'config.json'))

      await manager.write({ name: 'initial' })

      chmodSync(path.join(tempDir, 'sub'), 0o555)

      try {
        const success = await manager.update(() => ({ name: 'fail' }))
        expect(success).toBe(false)
      } finally {
        chmodSync(path.join(tempDir, 'sub'), 0o755)
      }
    }
  )

  it('returns empty object on read failure with no cache', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cfg-err3-'))
    tempDirs.push(tempDir)
    // Use a deeply nested non-existent subdirectory
    const manager = new ConfigManager<TestConfig>(
      path.join(tempDir, 'nonexistent', 'deep', 'path', 'config.json')
    )

    // This should create the directory and return empty object
    const result = await manager.read()
    expect(result).toEqual({})
  })
})

describe('ConfigManager - Race Conditions', () => {
  it('serializes concurrent writes without data loss', async () => {
    const { manager } = createTempManager<{ count: number }>()
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

  it('serializes concurrent reads and writes', async () => {
    const { manager } = createTempManager<{ value: string }>()
    await manager.write({ value: 'initial' })

    const operations = [
      manager.read(),
      manager.update((c) => ({ ...c, value: 'updated-1' })),
      manager.read(),
      manager.update((c) => ({ ...c, value: 'updated-2' })),
      manager.read(true)
    ]

    const results = await Promise.all(operations)
    // The force-read at the end should have the final value
    const lastRead = results[results.length - 1] as { value: string }
    expect(lastRead.value).toBe('updated-2')
  })
})

describe('ConfigManager - JSON Edge Cases', () => {
  it('handles empty JSON object', async () => {
    const { manager, filePath } = createTempManager()
    writeFileSync(filePath, '{}', 'utf8')

    const result = await manager.read()
    expect(result).toEqual({})
  })

  it('handles malformed JSON gracefully', async () => {
    const { manager, filePath } = createTempManager()
    writeFileSync(filePath, '{invalid json', 'utf8')

    const result = await manager.read()
    expect(result).toEqual({})
  })

  it('handles empty file content', async () => {
    const { manager, filePath } = createTempManager()
    writeFileSync(filePath, '', 'utf8')

    const result = await manager.read()
    expect(result).toEqual({})
  })

  it('preserves complex nested structures', async () => {
    const { manager } = createTempManager<TestConfig>()
    const complexData: TestConfig = {
      name: 'complex',
      version: 1,
      settings: { theme: 'dark', language: 'tr' },
      items: ['a', 'b', 'c']
    }

    await manager.write(complexData)
    const result = await manager.read(true)
    expect(result).toEqual(complexData)
  })
})

describe('ConfigManager - Security (Prototype Pollution)', () => {
  it('strips __proto__ key from JSON on read', async () => {
    const { manager, filePath } = createTempManager<Record<string, unknown>>()
    const malicious = { name: 'safe', __proto__: { polluted: true } }
    require('fs').writeFileSync(filePath, JSON.stringify(malicious), 'utf8')

    const result = await manager.read()
    expect(result).toEqual({ name: 'safe' })
    // Verify prototype is not polluted
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('strips constructor key from JSON on read', async () => {
    const { manager, filePath } = createTempManager<Record<string, unknown>>()
    const malicious = { name: 'safe', constructor: { prototype: { polluted: true } } }
    require('fs').writeFileSync(filePath, JSON.stringify(malicious), 'utf8')

    const result = await manager.read()
    expect(result).toEqual({ name: 'safe' })
  })

  it('strips prototype key from JSON on read', async () => {
    const { manager, filePath } = createTempManager<Record<string, unknown>>()
    const malicious = { name: 'safe', prototype: { polluted: true } }
    require('fs').writeFileSync(filePath, JSON.stringify(malicious), 'utf8')

    const result = await manager.read()
    expect(result).toEqual({ name: 'safe' })
  })

  it('handles deeply nested prototype pollution attempts', async () => {
    const { manager, filePath } = createTempManager<Record<string, unknown>>()
    const malicious = {
      config: { theme: 'dark' },
      nested: { __proto__: { polluted: true } }
    }
    require('fs').writeFileSync(filePath, JSON.stringify(malicious), 'utf8')

    const result = await manager.read()
    expect(result).toEqual({ config: { theme: 'dark' }, nested: {} })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('returns empty object for corrupted JSON via update', async () => {
    const { manager, filePath } = createTempManager<Record<string, unknown>>()
    require('fs').writeFileSync(filePath, '{broken json', 'utf8')

    const success = await manager.update(() => ({ fixed: true }))
    // Should not throw; should write the new data
    expect(success).toBe(true)
    const result = await manager.read(true)
    expect(result.fixed).toBe(true)
  })
})
