/**
 * The English and Turkish bundles are checked against each other and against
 * i18next's own syntax, because a missing key or a mismatched interpolation
 * placeholder renders as a raw `{name}` in the middle of the UI and nothing else
 * in the app would notice.
 */
import '@shared/i18n/i18next'

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
