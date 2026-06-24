import { promises as fs } from 'fs'
import path from 'path'

import { Logger } from './logger.js'

const PROHIBITED_CONFIG_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * SECURITY: Parse JSON with prototype pollution protection.
 * Strips __proto__, constructor, and prototype keys during parsing
 * to prevent pollution attacks via malicious config files.
 */
function safeParse<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw, (key: string, val: unknown) => {
      if (PROHIBITED_CONFIG_KEYS.has(key)) {
        return undefined
      }
      return val
    })
    return (parsed !== null && typeof parsed === 'object' ? parsed : fallback) as T
  } catch {
    Logger.warn('[ConfigManager] Corrupted JSON, resetting to defaults')
    return fallback
  }
}

/**
 * Generic JSON configuration manager for persistence
 * Uses a single operation queue to prevent race conditions between read and write operations.
 */
export class ConfigManager<T extends object> {
  private filePath: string
  private cache: T | null = null
  /**
   * Single operation queue that serializes all read and write operations.
   * This prevents race conditions where a read and write could interleave.
   */
  private operationQueue: Promise<unknown> = Promise.resolve()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  private async ensureFile(): Promise<void> {
    try {
      await fs.access(this.filePath)
    } catch {
      const dir = path.dirname(this.filePath)
      try {
        await fs.access(dir)
      } catch {
        await fs.mkdir(dir, { recursive: true })
      }
      await fs.writeFile(this.filePath, JSON.stringify({}, null, 2), 'utf8')
    }
  }

  /**
   * Enqueues an operation in the serial queue to prevent race conditions.
   * All reads and writes are serialized through this queue.
   */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation) as Promise<T>
    // Ensure queue continues even if operation fails
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  public async read(force: boolean = false): Promise<T> {
    if (this.cache && !force) return this.cache

    return this.enqueue(async () => {
      try {
        await this.ensureFile()
        const data = await fs.readFile(this.filePath, 'utf8')
        this.cache = safeParse<T>(data || '{}', (this.cache || {}) as T)
        return this.cache
      } catch (error) {
        Logger.error(`[ConfigManager] Failed to read ${this.filePath}:`, error)
        return (this.cache || {}) as T
      }
    })
  }

  public async write(config: T): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        await this.ensureFile()
        const content = JSON.stringify(config, null, 2)

        const tempPath = `${this.filePath}.tmp`
        await fs.writeFile(tempPath, content, 'utf8')
        await fs.rename(tempPath, this.filePath)

        this.cache = config
        return true
      } catch (error) {
        Logger.error(`[ConfigManager] Failed to write ${this.filePath}:`, error)
        return false
      }
    })
  }

  public async update(updater: (current: T) => T | Promise<T>): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        await this.ensureFile()
        let current: T
        if (this.cache) {
          current = this.cache
        } else {
          const content = await fs.readFile(this.filePath, 'utf8')
          current = safeParse<T>(content || '{}', {} as T)
          this.cache = current
        }
        const updated = await updater(current)
        const content = JSON.stringify(updated, null, 2)

        const tempPath = `${this.filePath}.tmp`
        await fs.writeFile(tempPath, content, 'utf8')
        await fs.rename(tempPath, this.filePath)

        this.cache = updated
        return true
      } catch (error) {
        Logger.error(`[ConfigManager] Failed to update ${this.filePath}:`, error)
        return false
      }
    })
  }

  public async getItem<K extends keyof T>(key: K): Promise<T[K] | undefined> {
    const data = await this.read()
    return data[key]
  }

  public async setItem<K extends keyof T>(key: K, val: T[K]): Promise<boolean> {
    return this.update((current) => ({
      ...current,
      [key]: val
    }))
  }

  public async deleteItem(key: keyof T): Promise<boolean> {
    return this.update((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  public async clear(): Promise<boolean> {
    return this.write({} as T)
  }
}
