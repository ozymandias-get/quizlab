import { promises as fs, existsSync } from 'fs'
import path from 'path'

/**
 * Generic JSON configuration manager for persistence
 */
export class ConfigManager<T extends object> {
  private filePath: string
  private cache: T | null = null
  private writeQueue: Promise<unknown> = Promise.resolve()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  private async ensureFile(): Promise<void> {
    if (!existsSync(this.filePath)) {
      const dir = path.dirname(this.filePath)
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true })
      }
      await fs.writeFile(this.filePath, JSON.stringify({}, null, 2), 'utf8')
    }
  }

  private readPromise: Promise<T> | null = null

  public async read(force: boolean = false): Promise<T> {
    if (this.cache && !force) return this.cache

    if (this.readPromise && !force) return this.readPromise

    this.readPromise = (async () => {
      try {
        await this.ensureFile()
        const data = await fs.readFile(this.filePath, 'utf8')
        this.cache = JSON.parse(data || '{}') as T
        return this.cache
      } catch (error) {
        console.error(`[ConfigManager] Failed to read ${this.filePath}:`, error)
        return (this.cache || {}) as T
      } finally {
        this.readPromise = null
      }
    })()

    return this.readPromise
  }

  public async write(data: T): Promise<boolean> {
    return this.enqueueWrite(() => this.writeDirect(data))
  }

  public async update(updater: (current: T) => T | Promise<T>): Promise<boolean> {
    return this.enqueueWrite(async () => {
      const current = await this.read(true)
      const updated = await updater(current)
      return this.writeDirect(updated)
    })
  }

  private async enqueueWrite<R>(task: () => Promise<R>): Promise<R> {
    const run = this.writeQueue.then(task, task)
    this.writeQueue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private async writeDirect(data: T): Promise<boolean> {
    try {
      await this.ensureFile()
      const content = JSON.stringify(data, null, 2)

      const tempPath = `${this.filePath}.tmp`
      await fs.writeFile(tempPath, content, 'utf8')
      await fs.rename(tempPath, this.filePath)

      this.cache = data
      return true
    } catch (error) {
      console.error(`[ConfigManager] Failed to write ${this.filePath}:`, error)
      return false
    }
  }

  public async getItem<K extends keyof T>(key: K): Promise<T[K] | undefined> {
    const data = await this.read()
    return data[key]
  }

  public async setItem<K extends keyof T>(key: K, value: T[K]): Promise<boolean> {
    return this.update((current) => ({
      ...current,
      [key]: value
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
