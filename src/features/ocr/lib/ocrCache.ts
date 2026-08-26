import type { OcrPageResult } from '../types'
import { OCR_CACHE_SCHEMA_VERSION } from '../types'

const STORAGE_KEY = `quizlab:ocr-cache:v${OCR_CACHE_SCHEMA_VERSION}`
const MAX_ENTRIES = 120
const MAX_ENTRY_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type CacheRecord = {
  key: string
  value: OcrPageResult
  savedAt: number
}

function loadMap(): Map<string, CacheRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, CacheRecord>
    const map = new Map<string, CacheRecord>()
    for (const [k, v] of Object.entries(parsed)) {
      // Validate schema version still matches (paranoid: key already contains v)
      if (!k.startsWith(`ocr:v${OCR_CACHE_SCHEMA_VERSION}:`)) continue
      if (!v || typeof v.value?.markdown !== 'string') continue
      // Expire old entries
      if (Date.now() - (v.savedAt || 0) > MAX_ENTRY_AGE_MS) continue
      // Expire if engine version mismatched via value metadata
      map.set(k, v)
    }
    return map
  } catch {
    return new Map()
  }
}

function persistMap(map: Map<string, CacheRecord>): void {
  try {
    // Evict oldest if over limit
    if (map.size > MAX_ENTRIES) {
      const entries = [...map.entries()].sort((a, b) => a[1].savedAt - b[1].savedAt)
      const toDelete = entries.slice(0, map.size - MAX_ENTRIES)
      for (const [k] of toDelete) map.delete(k)
    }
    const obj: Record<string, CacheRecord> = {}
    for (const [k, v] of map) obj[k] = v
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // Quota exceeded — evict half and retry once
    try {
      const entries = [...map.entries()].sort((a, b) => a[1].savedAt - b[1].savedAt)
      const toDelete = entries.slice(0, Math.ceil(map.size / 2))
      for (const [k] of toDelete) map.delete(k)
      const obj: Record<string, CacheRecord> = {}
      for (const [k, v] of map) obj[k] = v
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
    } catch {
      // give up
    }
  }
}

export const ocrCache = {
  get(key: string): OcrPageResult | null {
    const map = loadMap()
    const rec = map.get(key)
    if (!rec) return null
    // Touch not needed; createdAt is immutable
    return rec.value
  },

  set(key: string, value: OcrPageResult): void {
    const map = loadMap()
    map.set(key, { key, value, savedAt: Date.now() })
    persistMap(map)
  },

  has(key: string): boolean {
    const map = loadMap()
    return map.has(key)
  },

  delete(key: string): void {
    const map = loadMap()
    map.delete(key)
    persistMap(map)
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  },

  size(): number {
    return loadMap().size
  },

  /** For tests: inject raw map */
  _loadRaw(): Map<string, CacheRecord> {
    return loadMap()
  }
}
