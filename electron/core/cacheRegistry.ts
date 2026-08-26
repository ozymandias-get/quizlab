import { app } from 'electron'
import path from 'path'

import { APP_CONFIG } from '../app/constants.js'
import { AI_REGISTRY, INACTIVE_PLATFORMS } from '../features/ai/aiManager.js'
import { Logger } from './logger.js'

type CacheCategory = 'temp' | 'cache' | 'session-cache'

export interface CacheRule {
  relativePath: string
  category: CacheCategory
  ttlMs: number | null
  maxBytes: number | null
  cleanupOnStartup: boolean
  cleanupOnIdle: boolean
  description: string
}

/**
 * Aktivite kategorileri ve karşılık gelen TTL çarpanları.
 * Son kullanım zamanına göre partition'ların ne kadar hızlı temizleneceğini belirler.
 */
export type ActivityCategory = 'active' | 'passive' | 'cold'

export const ACTIVITY_TTL: Record<ActivityCategory, number> = {
  active: APP_CONFIG.CLEANUP.CACHE_FILE_TTL_MS, // 7 gün
  passive: 2 * 24 * 60 * 60 * 1000, // 2 gün
  cold: 12 * 60 * 60 * 1000 // 12 saat
}

export const ACTIVITY_THRESHOLDS = {
  active: 60 * 60 * 1000, // 1 saat
  passive: 24 * 60 * 60 * 1000 // 24 saat
}

/**
 * Partition aktivite takipçisi.
 * Her partition'un en son ne zaman kullanıldığını bellekte tutar.
 * Soğuk partition'ların önbelleği daha agresif temizlenir.
 */
const partitionActivity = new Map<string, number>()

/** Partition'un son kullanım zamanını günceller */
export function markPartitionActive(partitionKey: string): void {
  if (!partitionKey) return
  const normalized = partitionKey.replace(/^persist:/, '')
  if (!normalized) return
  partitionActivity.set(normalized, Date.now())
}

/** Partition'un aktivite kategorisini döndürür */
export function getActivityCategory(partitionKey: string): ActivityCategory {
  const normalized = partitionKey.replace(/^persist:/, '')
  const lastAccessed = partitionActivity.get(normalized)
  if (!lastAccessed) return 'cold' // Hiç kullanılmamış → soğuk

  const elapsed = Date.now() - lastAccessed
  if (elapsed < ACTIVITY_THRESHOLDS.active) return 'active'
  if (elapsed < ACTIVITY_THRESHOLDS.passive) return 'passive'
  return 'cold'
}

/** Partition için geçerli TTL'yi döndürür (aktiviteye göre) */
export function getEffectiveTtl(partitionKey: string): number {
  const category = getActivityCategory(partitionKey)
  return ACTIVITY_TTL[category]
}

/** Partition'un son aktivite zamanını döndürür (ms) */
export function getPartitionLastActive(partitionKey: string): number | null {
  const normalized = partitionKey.replace(/^persist:/, '')
  return partitionActivity.get(normalized) ?? null
}

/** Tüm partition aktivitelerini döndürür */
export function getAllPartitionActivities(): Record<
  string,
  { lastActive: number | null; category: ActivityCategory; ttlMs: number }
> {
  const keys = collectAllPartitionKeys()
  const result: Record<
    string,
    { lastActive: number | null; category: ActivityCategory; ttlMs: number }
  > = {}
  for (const key of keys) {
    result[key] = {
      lastActive: getPartitionLastActive(key),
      category: getActivityCategory(key),
      ttlMs: getEffectiveTtl(key)
    }
  }
  // Dinamik (henüz registry'de olmayan ama activity'si olan) partition'lar da ekle
  for (const [k, v] of partitionActivity.entries()) {
    if (!(k in result)) {
      result[k] = {
        lastActive: v,
        category: getActivityCategory(k),
        ttlMs: getEffectiveTtl(k)
      }
    }
  }
  return result
}

/** Partition'ları eviction önceliğine göre sırala (cold büyük önce) */
export function sortPartitionsByEvictionPriority(
  sizes: Record<string, number>
): Array<{ key: string; size: number; category: ActivityCategory }> {
  const entries = Object.entries(sizes).map(([key, size]) => ({
    key,
    size,
    category: getActivityCategory(key)
  }))
  return entries.sort((a, b) => {
    const order = { cold: 0, passive: 1, active: 2 } as const
    if (order[a.category] !== order[b.category]) return order[a.category] - order[b.category]
    return b.size - a.size
  })
}

/** Sadece test/sıfırlama için */
export function _resetActivityTracker(): void {
  partitionActivity.clear()
}

const { SAFE_CACHE_DIRS, TEMP_FILE_TTL_MS, CACHE_FILE_TTL_MS } = APP_CONFIG.CLEANUP

function partitionCacheRules(partitionKey: string): CacheRule[] {
  // Aktivite bazlı TTL: soğuk partition'lar daha hızlı temizlenir
  const ttlMs = getEffectiveTtl(partitionKey)
  const category = getActivityCategory(partitionKey)
  return SAFE_CACHE_DIRS.map((dir) => ({
    relativePath: path.join('Partitions', partitionKey, dir),
    category: 'cache' as CacheCategory,
    ttlMs,
    maxBytes: null,
    cleanupOnStartup: false,
    cleanupOnIdle: true,
    description: `Partition ${partitionKey} ${dir} (${category}, TTL=${ttlMs / 1000 / 60 / 60}h)`
  }))
}

function buildProtectedFiles(): Set<string> {
  return new Set([
    'window-state.json',
    'pdf-allowlist.json',
    'ai_custom_selectors.json',
    'ai_custom_platforms.json',
    'api_chat_config.json',
    'gemini-web-session.json'
  ])
}

function buildProtectedDirs(): Set<string> {
  return new Set(['gemini-web-profile'])
}

const protectedFiles = buildProtectedFiles()
const protectedDirs = buildProtectedDirs()

const BASE_RULES: CacheRule[] = SAFE_CACHE_DIRS.map((dir) => ({
  relativePath: dir,
  category: 'cache' as CacheCategory,
  ttlMs: CACHE_FILE_TTL_MS,
  maxBytes: null,
  cleanupOnStartup: false,
  cleanupOnIdle: true,
  description: `Root ${dir}`
}))

/**
 * Tüm AI partition'larının anahtarlarını toplar.
 * Hem aktif (AI_REGISTRY) hem pasif (INACTIVE_PLATFORMS) platformları
 * hem de varsayılan AI partition'ını kapsar.
 */
function collectAllPartitionKeys(): Set<string> {
  const keys = new Set<string>()

  // 1. Varsayılan AI partition'ı (persist:ai_session)
  if (APP_CONFIG.PARTITIONS.AI) {
    keys.add(APP_CONFIG.PARTITIONS.AI.replace('persist:', ''))
  }

  // 2. Aktif AI platformları
  for (const p of Object.values(AI_REGISTRY)) {
    if (p.partition) keys.add(p.partition.replace('persist:', ''))
  }

  // 3. Pasif (kayıtlı ama aktif olmayan) platformlar
  for (const p of Object.values(INACTIVE_PLATFORMS)) {
    if (p.partition) keys.add(p.partition.replace('persist:', ''))
  }

  return keys
}

export function getCacheRules(): CacheRule[] {
  const rules = [...BASE_RULES]

  const partitions = collectAllPartitionKeys()
  for (const partitionKey of partitions) {
    rules.push(...partitionCacheRules(partitionKey))
  }

  return rules
}

export function getProtectedFiles(): ReadonlySet<string> {
  return protectedFiles
}

export function getProtectedDirs(): ReadonlySet<string> {
  return protectedDirs
}

export function isProtectedPath(targetPath: string, userDataPath: string): boolean {
  const normalizedTarget = path.normalize(targetPath)
  const relative = path.relative(userDataPath, normalizedTarget)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return true
  }

  const segments = relative.split(path.sep).filter(Boolean)
  if (segments.length === 0) return true

  const fileName = segments[segments.length - 1]
  if (protectedFiles.has(fileName)) return true

  for (const protectedDir of protectedDirs) {
    if (segments.includes(protectedDir)) return true
  }

  if (segments[0] === 'Partitions' && segments.length >= 4) {
    const storageSubdir = segments[segments.length - 2]
    const protectedStorage = new Set([
      'cookies',
      'localstorage',
      'indexdb',
      'databases',
      'Session Storage',
      'IndexedDB',
      'Local Storage'
    ])
    if (protectedStorage.has(storageSubdir)) return true
  }

  return false
}

export function isSymlinkSafe(targetPath: string): boolean {
  try {
    const normalized = path.resolve(targetPath)
    const userDataPath = path.resolve(app.getPath('userData'))
    if (!normalized.startsWith(userDataPath)) return false
    return true
  } catch {
    return false
  }
}
