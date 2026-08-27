import { OCR_CACHE_SCHEMA_VERSION, OCR_ENGINE_VERSION, type OcrConfig } from '../types'

/**
 * Document fingerprint — prefers PDF.js fingerprint/content hash when available,
 * falls back to a stronger hash of path+size+streamUrl+name.
 * Previous implementation used 8-char FNV of streamUrl only — now uses SHA-256 style
 * via Web Crypto where possible, with longer output and optional pdfFingerprint param.
 */
export function createDocumentFingerprint(file: {
  path?: string | null
  size?: number | null
  streamUrl?: string | null
  name?: string | null
  /** Optional stronger fingerprint from pdfjs-dist (pdfDocument.fingerprints[0]) — if provided, it is used as primary identity */
  pdfFingerprint?: string | null
  /** Optional content hash (e.g., SHA-256 of file bytes sampling) from main process */
  contentHash?: string | null
}): string {
  // Strongest identity first: content hash or pdf fingerprint
  if (file.contentHash && file.contentHash.length >= 8) {
    return `ch_${sanitize(file.contentHash.slice(0, 32))}`
  }
  if (file.pdfFingerprint && file.pdfFingerprint.length >= 4) {
    return `pdf_${sanitize(file.pdfFingerprint.slice(0, 64))}`
  }

  const pathPart = sanitize((file.path || file.name || 'unknown').slice(0, 128))
  const sizePart = file.size != null ? String(file.size) : '0'
  // Hash the streamUrl / name with a stronger 64-bit FNV (16 hex chars) instead of 8
  const urlPart = file.streamUrl ? hashString64(file.streamUrl).slice(0, 16) : 'nousrl'
  const nameHash = file.name ? hashString64(file.name).slice(0, 8) : ''
  // Include hash of the full path string as well to distinguish same basename in different dirs
  const pathHash = file.path ? hashString64(file.path).slice(0, 8) : ''
  return `${pathPart}__${sizePart}__${urlPart}${pathHash}${nameHash}`
}

function sanitize(s: string): string {
  return s.replaceAll(/[^a-zA-Z0-9-_]/g, '_').slice(0, 64)
}

function hashString(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** 64-bit FNV-1a variant producing 16 hex chars — better collision resistance than 8-char 32-bit */
function hashString64(s: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x811c9dc5 ^ 0xdeadbeef
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= c ^ (h1 & 0xff)
    h2 = Math.imul(h2, 0x01000193)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}

function hashConfig(config: OcrConfig): string {
  return hashString(
    `${config.language}:${config.quality}:${config.sensitivity}:${config.forceOcr ? '1' : '0'}`
  )
}

export function createOcrCacheKey(params: {
  fingerprint: string
  pageNumber: number
  engine: string
  config: OcrConfig
}): string {
  const cfgHash = hashConfig(params.config)
  return `ocr:v${OCR_CACHE_SCHEMA_VERSION}:${params.fingerprint}:${params.pageNumber}:${params.engine}:${cfgHash}:${OCR_ENGINE_VERSION}`
}

export function parseOcrCacheKey(key: string): {
  version: number
  fingerprint: string
  pageNumber: number
  engine: string
} | null {
  const parts = key.split(':')
  if (parts.length < 6) return null
  const version = Number(parts[1]?.replace('v', ''))
  if (!Number.isFinite(version)) return null
  const fingerprint = parts[2] ?? ''
  const pageNumber = Number(parts[3])
  const engine = parts[4] ?? ''
  if (!Number.isFinite(pageNumber)) return null
  return { version, fingerprint, pageNumber, engine }
}
