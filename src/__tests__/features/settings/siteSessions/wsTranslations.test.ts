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

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const REPO_ROOT = join(SRC_ROOT, '..')

/**
 * The files the site-session UI reads its keys from.
 *
 * The tab itself is one folder, but the toolbar button, the tab definitions
 * and the bottom-bar settings live outside it and carry keys of their own.
 * The shared constant that names the member apps of a row lives outside the
 * renderer as well, so it is scanned here too.
 */
const SCANNED_PATHS = [
  join(SRC_ROOT, 'features', 'settings', 'ui', 'siteSessions'),
  join(SRC_ROOT, 'app', 'ui', 'BottomBar', 'FloatingDockToolButtons.tsx'),
  join(SRC_ROOT, 'features', 'settings', 'ui', 'modal', 'settingsTabDefinitions.tsx'),
  join(SRC_ROOT, 'features', 'settings', 'ui', 'BottomBarSettingsTab.tsx'),
  join(REPO_ROOT, 'shared', 'constants', 'siteSessionMemberApps.ts')
]

const LOCALE_FILES = {
  en: join(SRC_ROOT, 'shared', 'i18n', 'locales', 'en', 'ws.json'),
  tr: join(SRC_ROOT, 'shared', 'i18n', 'locales', 'tr', 'ws.json')
}

/** The main process answers a refusal with one of these codes. */
const MAIN_PROCESS_DIR = join(REPO_ROOT, 'electron', 'features', 'web-session')

/** The browser-dev stub answers every action with one code. */
const BROWSER_STUB = join(SRC_ROOT, 'platform', 'electron', 'createBrowserElectronApi.ts')

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

/**
 * The error codes the service and the IPC handlers can produce.
 *
 * `web_dev_mode_only` comes from the browser-dev stub, which has no bridge to
 * import from; the rest are read from the main process itself. The list also
 * holds the reason codes a site is recorded with, because the renderer shows
 * them through the same `ws_error_*` keys.
 */
const ERROR_CODES = [
  'unknown_target',
  'write_failed',
  'wipe_failed',
  'switch_off_wipe_failed',
  'invalid_site_id',
  'invalid_enabled',
  'import_failed',
  'packet_too_large',
  'Unauthorized',
  'web_dev_mode_only'
]

let en: Dict = {}
let tr: Dict = {}

beforeAll(async () => {
  await i18next.changeLanguage('en')
  en = i18next.getResourceBundle('en', 'translation') as Dict
  tr = i18next.getResourceBundle('tr', 'translation') as Dict
})

function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path]
  const out: string[] = []
  for (const entry of readdirSync(path)) {
    const full = join(path, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/**
 * The translation keys the sources name.
 *
 * A key is named either by a call of the translation function or by one of the
 * `*Key` props of a tab or a tool definition.
 */
function literalKeys(): string[] {
  const found = new Set<string>()
  for (const file of SCANNED_PATHS.flatMap(sourceFiles)) {
    const src = readFileSync(file, 'utf8')
    for (const [, key] of src.matchAll(/\bt\(\s*'([a-z][a-z0-9_]*)'/g)) {
      found.add(key)
    }
    for (const [, key] of src.matchAll(
      /\b(?:labelKey|descriptionKey|nameKey):\s*'([a-z][a-z0-9_]*)'/g
    )) {
      found.add(key)
    }
  }
  return [...found].sort()
}

/** The error codes the main process can answer with. */
function mainProcessErrorCodes(): string[] {
  const found = new Set<string>()
  for (const file of [...sourceFiles(MAIN_PROCESS_DIR), BROWSER_STUB]) {
    const src = readFileSync(file, 'utf8')
    for (const [, code] of src.matchAll(/\berror:\s*'([A-Za-z][A-Za-z0-9_]*)'/g)) {
      found.add(code)
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

  it('finds the error codes of the main process to check', () => {
    // Guards the scan itself: if this drops to zero the gate below is vacuous.
    expect(mainProcessErrorCodes().length).toBeGreaterThan(3)
  })

  it('translates every error code the main process can answer with', () => {
    const missing = mainProcessErrorCodes()
      .map((code) => `ws_error_${code}`)
      .filter((key) => typeof en[key] !== 'string' || typeof tr[key] !== 'string')
    expect(missing).toEqual([])
  })

  it('carries the same keys in both locales', () => {
    const enKeys = Object.keys(JSON.parse(readFileSync(LOCALE_FILES.en, 'utf8')) as Dict)
    const trKeys = Object.keys(JSON.parse(readFileSync(LOCALE_FILES.tr, 'utf8')) as Dict)

    expect(enKeys.filter((key) => !trKeys.includes(key))).toEqual([])
    expect(trKeys.filter((key) => !enKeys.includes(key))).toEqual([])
  })

  // The app interpolates with a single brace, so a doubled one would reach
  // the user as text: "Hesap {{index}}" instead of "Hesap 2".
  it('keeps the placeholders of the account labels interpolatable', () => {
    expect(String(en.ws_account_default)).toContain('{index}')
    expect(String(tr.ws_account_default)).toContain('{index}')
    expect(String(en.ws_accounts_count)).toContain('{count}')
    expect(String(tr.ws_accounts_count)).toContain('{count}')
    expect(String(en.ws_account_default)).not.toContain('{{')
    expect(String(tr.ws_accounts_count)).not.toContain('{{')
  })

  // The clear button forgets the sites whose import switch is on. A sign-in
  // made inside the app belongs to a site whose switch is off, so it is not
  // forgotten - the hint must not promise the opposite.
  it('does not promise that a sign-in made inside the app is cleared', () => {
    expect(String(en.ws_clear_all_hint)).not.toMatch(/sign-in made inside the app is cleared/i)
    expect(String(tr.ws_clear_all_hint)).not.toMatch(/girişler de temizlenir/i)
  })

  it('ties the hint to the accounts whose switch is on', () => {
    expect(String(en.ws_clear_all_hint)).toMatch(/switch/i)
    expect(String(tr.ws_clear_all_hint)).toMatch(/anahtar/i)
  })
})
