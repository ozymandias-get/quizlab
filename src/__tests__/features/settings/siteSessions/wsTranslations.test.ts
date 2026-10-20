/**
 * Every key the site-sessions UI uses has to exist in both languages.
 *
 * A missing key is not an error in this app: i18next hands the key back, so
 * the user reads "ws_status_signed_out" on the card instead of a sentence.
 * Nothing else would notice, so the keys are pinned here.
 */
import '@shared/i18n/i18next'

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

type Dict = Record<string, unknown>

const SITE_SESSIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'features',
  'settings',
  'ui',
  'siteSessions'
)

/** The statuses a row can show. */
const STATUS_CODES = [
  'extension_missing',
  'extension_outdated',
  'extension_connected',
  'permission_missing',
  'no_cookies_in_browser',
  'imported',
  'import_failed',
  'manual_session',
  'signed_out'
]

/** The sites the app knows about. */
const TARGET_IDS = [
  'google',
  'custom',
  'chatgpt',
  'claude',
  'deepseek',
  'qwen',
  'kimi',
  'm365',
  'copilot',
  'grok',
  'mistral',
  'perplexity',
  'huggingchat',
  'manus'
]

/** The error codes the service and the IPC handlers can produce. */
const ERROR_CODES = [
  'unknown_target',
  'write_failed',
  'wipe_failed',
  'switch_off_wipe_failed',
  'invalid_site_id',
  'invalid_enabled',
  'Unauthorized'
]

let en: Dict = {}
let tr: Dict = {}

beforeAll(async () => {
  await i18next.changeLanguage('en')
  en = i18next.getResourceBundle('en', 'translation') as Dict
  tr = i18next.getResourceBundle('tr', 'translation') as Dict
})

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** The translation keys the source names literally. */
function literalKeys(): string[] {
  const found = new Set<string>()
  for (const file of sourceFiles(SITE_SESSIONS_DIR)) {
    const src = readFileSync(file, 'utf8')
    for (const [, key] of src.matchAll(/['"`](ws_[a-zA-Z0-9_]+)['"`]/g)) {
      found.add(key)
    }
  }
  return [...found].sort()
}

describe('site session translations', () => {
  it('names the keys of the site session sources', () => {
    // Guards the scan itself: if this drops to zero the gate below is vacuous.
    expect(literalKeys().length).toBeGreaterThan(20)
  })

  it('translates every key the sources name', () => {
    const missing = literalKeys().filter(
      (key) => typeof en[key] !== 'string' || typeof tr[key] !== 'string'
    )
    expect(missing).toEqual([])
  })

  it('translates every status a row can show', () => {
    const missing = STATUS_CODES.map((code) => `ws_status_${code}`).filter(
      (key) => typeof en[key] !== 'string' || typeof tr[key] !== 'string'
    )
    expect(missing).toEqual([])
  })

  it('translates every site the app knows about', () => {
    const missing = TARGET_IDS.map((id) => `ws_target_${id}`).filter(
      (key) => typeof en[key] !== 'string' || typeof tr[key] !== 'string'
    )
    expect(missing).toEqual([])
  })

  it('translates every error code the service can produce', () => {
    const missing = ERROR_CODES.map((code) => `ws_error_${code}`).filter(
      (key) => typeof en[key] !== 'string' || typeof tr[key] !== 'string'
    )
    expect(missing).toEqual([])
  })
})
