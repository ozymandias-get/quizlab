import type { OcrPageResult } from '../types'
import { OCR_CACHE_SCHEMA_VERSION } from '../types'

const STORAGE_KEY = `quizlab:ocr-cache:v${OCR_CACHE_SCHEMA_VERSION}`
const MAX_ENTRIES = 120
const MAX_ENTRY_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_APPROX_BYTES = 4_500_000 // ~4.5MB budget (localStorage quota ~5MB)

type CacheRecord = {
  key: string
  value: OcrPageResult
  savedAt: number
  /** Last access time for true LRU eviction */
  lastAccessedAt: number
  /** Approximate byte size for budget-aware eviction */
  approxBytes: number
}

function approxSize(value: OcrPageResult): number {
  try {
    return JSON.stringify(value).length * 2 // approx utf16 bytes
  } catch {
    return 2048
  }
}

function loadMap(): Map<string, CacheRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, CacheRecord>
    const map = new Map<string, CacheRecord>()
    let expiredCount = 0
    let filteredCount = 0
    for (const [k, v] of Object.entries(parsed)) {
      if (!k.startsWith(`ocr:v${OCR_CACHE_SCHEMA_VERSION}:`)) {
        filteredCount++
        continue
      }
      if (!v || typeof v.value?.markdown !== 'string') {
        filteredCount++
        continue
      }
      if (Date.now() - (v.savedAt || 0) > MAX_ENTRY_AGE_MS) {
        expiredCount++
        continue
      }
      // Normalize missing fields from old cache entries
      if (!v.lastAccessedAt) v.lastAccessedAt = v.savedAt || Date.now()
      if (!v.approxBytes) v.approxBytes = approxSize(v.value)
      map.set(k, v)
    }
    // Immediately persist cleanup if any entries were expired/filtered — satisfies P0 requirement to purge expired from disk
    if ((expiredCount > 0 || filteredCount > 0) && map.size !== Object.keys(parsed).length) {
      // Defer persist slightly to avoid re-entrancy during get paths; but ensure disk is cleaned
      try {
        const obj: Record<string, CacheRecord> = {}
        for (const [k, v] of map) obj[k] = v
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
      } catch {}
    }
    return map
  } catch {
    return new Map()
  }
}

function persistMap(map: Map<string, CacheRecord>): void {
  try {
    // Budget-aware LRU eviction: sort by lastAccessedAt (oldest first)
    if (map.size > MAX_ENTRIES || estimateTotalBytes(map) > MAX_APPROX_BYTES) {
      const entries = [...map.entries()].sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt)
      let bytes = estimateTotalBytes(map)
      let count = map.size
      for (const [k] of entries) {
        if (count <= MAX_ENTRIES && bytes <= MAX_APPROX_BYTES) break
        const rec = map.get(k)
        if (rec) bytes -= rec.approxBytes
        map.delete(k)
        count--
      }
    }
    const obj: Record<string, CacheRecord> = {}
    for (const [k, v] of map) obj[k] = v
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // Quota exceeded — evict half oldest and retry once
    try {
      const entries = [...map.entries()].sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt)
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

function estimateTotalBytes(map: Map<string, CacheRecord>): number {
  let total = 0
  for (const v of map.values()) total += v.approxBytes
  return total
}

export const ocrCache = {
  get(key: string): OcrPageResult | null {
    const map = loadMap()
    const rec = map.get(key)
    if (!rec) return null
    // True LRU: touch lastAccessedAt and persist
    rec.lastAccessedAt = Date.now()
    map.set(key, rec)
    try {
      persistMap(map)
    } catch {}
    return rec.value
  },

  set(key: string, value: OcrPageResult): void {
    // Do not cache empty/error outcomes as success — they pollute cache
    const outcome = (value as unknown as Record<string, unknown>).outcome as string | undefined
    if (outcome && outcome !== 'success') return
    if (!value.markdown || value.markdown.trim().length === 0) return
    const map = loadMap()
    map.set(key, {
      key,
      value,
      savedAt: Date.now(),
      lastAccessedAt: Date.now(),
      approxBytes: approxSize(value)
    })
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
