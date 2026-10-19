/**
 * The English and Turkish bundles are checked against each other and against
 * i18next's own syntax, because a missing key or a mismatched interpolation
 * placeholder renders as a raw `{name}` in the middle of the UI and nothing else
 * in the app would notice.
 */
import '@shared/i18n/i18next'

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

type Dict = Record<string, unknown>

let en: Dict = {}
let tr: Dict = {}

beforeAll(async () => {
  await i18next.changeLanguage('en')
  en = i18next.getResourceBundle('en', 'translation') as Dict
  tr = i18next.getResourceBundle('tr', 'translation') as Dict
})

/** Every string in the bundle, with its dotted path. */
function strings(dict: Dict, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const [key, value] of Object.entries(dict)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.push([path, value])
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...strings(value as Dict, path))
    }
  }
  return out
}

const leafKeys = (dict: Dict): string[] => strings(dict).map(([key]) => key)

const placeholders = (text: string): string[] =>
  (text.match(/{(\w+)}/g) ?? []).map((m) => m.slice(1, -1)).sort()

function getNestedValue(dict: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    return acc && typeof acc === 'object' ? (acc as Dict)[part] : undefined
  }, dict)
}

function placeholderMismatches(from: Dict, to: Dict, direction: string): string[] {
  const mismatches: string[] = []
  for (const [key, value] of strings(from)) {
    const target = getNestedValue(to, key)
    if (typeof target !== 'string') {
      mismatches.push(`${direction} ${key} (missing or not a string)`)
      continue
    }
    const source = placeholders(value)
    if (source.length === 0) continue
    if (JSON.stringify(source) !== JSON.stringify(placeholders(target))) {
      mismatches.push(
        `${direction} ${key} (source [${source.join(',')}] vs target [${placeholders(target).join(',')}])`
      )
    }
  }
  return mismatches
}

describe('i18n bundles', () => {
  it('loads both languages with a substantial number of keys', () => {
    expect(leafKeys(en).length).toBeGreaterThanOrEqual(200)
    expect(leafKeys(tr).length).toBeGreaterThanOrEqual(200)
  })

  it('has matching leaf keys in both directions', () => {
    const enKeys = leafKeys(en)
    const trKeys = leafKeys(tr)
    expect(enKeys.filter((k) => !trKeys.includes(k))).toEqual([])
    expect(trKeys.filter((k) => !enKeys.includes(k))).toEqual([])
  })

  it('has no empty values', () => {
    const empty = [...strings(en), ...strings(tr)]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key)
    expect(empty).toEqual([])
  })

  it('interpolates the same placeholders in both directions', () => {
    expect(placeholderMismatches(en, tr, 'en→tr')).toEqual([])
    expect(placeholderMismatches(tr, en, 'tr→en')).toEqual([])
  })

  // A bare `"{count} items"` key renders "1 items"; i18next only pluralises when
  // the key carries the `_one` / `_other` suffixes.
  it.each([
    ['ai_draft_content_count_one', 'ai_draft_content_count_other'],
    ['ai_send_clear_all_confirm_one', 'ai_send_clear_all_confirm_other']
  ])('%s has a plural sibling', (oneKey, otherKey) => {
    for (const dict of [en, tr]) {
      expect(typeof getNestedValue(dict, oneKey)).toBe('string')
      expect(typeof getNestedValue(dict, otherKey)).toBe('string')
    }
  })
})

describe('i18n value quality', () => {
  it.each([
    ['a double-brace {{placeholder}}', (v: string) => v.includes('{{') || v.includes('}}')],
    ['a foreign %{placeholder}', (v: string) => v.includes('%{')],
    // A leaked interpolation renders as the literal text "{undefined}".
    ['an unresolved {undefined}', (v: string) => v.includes('{undefined}') || v.includes('{null}')],
    ['leftover placeholder text', (v: string) => /TODO|FIXME|XXX|LOREM|IPSUM/i.test(v)],
    // A 500-character "translation" is a pasted paragraph, not copy.
    ['an unreasonably long value', (v: string) => v.length > 500]
  ])('no English value contains %s', (_case, isBad) => {
    expect(
      strings(en)
        .filter(([, value]) => isBad(value))
        .map(([key]) => key)
    ).toEqual([])
  })

  it('does not leave the English copy as its own key', () => {
    const untranslated = strings(en)
      .filter(([key, value]) => value === key)
      .map(([key]) => key)
    // A handful of proper nouns are legitimately identical to their key.
    expect(untranslated.length).toBeLessThanOrEqual(5)
  })
})

/**
 * The bundles cannot know about an error code until someone adds it, so this
 * walks the send pipelines for machine codes and requires each one to resolve.
 * toErrorToastKey maps anything it cannot find to error_unknown_error, which
 * keeps the toast readable but silently downgrades a specific message to a
 * generic one -- a failure worth failing a build over.
 */
describe('machine error codes', () => {
  const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

  function sourceFiles(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        out.push(...sourceFiles(full))
      } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
        out.push(full)
      }
    }
    return out
  }

  /** `error: '<machine_code>'` -- the shape AiSendResult carries. */
  function machineCodes(): string[] {
    const found = new Set<string>()
    for (const file of sourceFiles(srcRoot)) {
      const src = readFileSync(file, 'utf8')
      for (const [, code] of src.matchAll(/\berror:\s*'([a-z][a-z0-9_]*)'/g)) {
        found.add(code)
      }
    }
    return [...found].sort()
  }

  it('finds the send pipeline codes to check', () => {
    // Guards the scan itself: if this drops to zero the gate below is vacuous.
    expect(machineCodes().length).toBeGreaterThan(10)
  })

  it('has a translation for every machine error code in both languages', () => {
    const missing = machineCodes()
      .map((code) => `error_${code}`)
      .filter(
        (key) =>
          typeof getNestedValue(en, key) !== 'string' || typeof getNestedValue(tr, key) !== 'string'
      )
    expect(missing).toEqual([])
  })
})
