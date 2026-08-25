import '@shared/i18n/i18next'

import i18next from 'i18next'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

type Dict = Record<string, unknown>

let enTranslations: Dict = {}
let trTranslations: Dict = {}

beforeAll(async () => {
  await i18next.changeLanguage('en')
  enTranslations = i18next.getResourceBundle('en', 'translation') as Dict
  trTranslations = i18next.getResourceBundle('tr', 'translation') as Dict
})

afterEach(() => {
  void i18next.changeLanguage('en')
})

function getStringValues(dict: Dict, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const [k, v] of Object.entries(dict)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') {
      out.push([path, v])
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...getStringValues(v as Dict, path))
    }
  }
  return out
}

function getLeafKeysForCheck(dict: Dict, prefix = ''): string[] {
  return getStringValues(dict, prefix).map(([k]) => k)
}

function extractPlaceholders(text: string): string[] {
  return (text.match(/{(\w+)}/g) || []).map((m) => m.slice(1, -1)).sort()
}

describe('i18n - translation value sanity', () => {
  it('no value contains literal {{ or }} (double-brace anti-pattern)', () => {
    const badKeys: string[] = []
    for (const [k, v] of getStringValues(enTranslations)) {
      if (v.includes('{{') || v.includes('}}')) badKeys.push(k)
    }
    expect(badKeys).toEqual([])
  })

  it('no value contains a literal %{...} (different i18n library syntax)', () => {
    const badKeys: string[] = []
    for (const [k, v] of getStringValues(enTranslations)) {
      if (v.includes('%{')) badKeys.push(k)
    }
    expect(badKeys).toEqual([])
  })

  it('no value has a literal unresolved mustache leak like {{name}} or {undefined}', () => {
    const badKeys: string[] = []
    for (const [k, v] of getStringValues(enTranslations)) {
      if (v.includes('{undefined}') || v.includes('{null}')) badKeys.push(k)
    }
    expect(badKeys).toEqual([])
  })
})

describe('i18n - placeholder consistency between en and tr', () => {
  function comparePlaceholders(
    a: Dict,
    b: Dict,
    direction: 'en→tr' | 'tr→en',
    mismatches: string[]
  ) {
    for (const [k, av] of Object.entries(a)) {
      if (av && typeof av === 'object' && !Array.isArray(av)) {
        const bv = b[k]
        if (!bv || typeof bv !== 'object') {
          mismatches.push(`${direction} ${k} (nested in source, not in target)`)
          continue
        }
        comparePlaceholders(av as Dict, bv as Dict, direction, mismatches)
        continue
      }
      if (typeof av !== 'string') continue
      const placeholders = extractPlaceholders(av)
      if (placeholders.length === 0) continue
      const bv = b[k]
      if (typeof bv !== 'string') {
        mismatches.push(`${direction} ${k} (missing in target)`)
        continue
      }
      const bPhs = extractPlaceholders(bv)
      if (JSON.stringify(bPhs) !== JSON.stringify(placeholders)) {
        mismatches.push(
          `${direction} ${k} (source: [${placeholders.join(',')}] vs target: [${bPhs.join(',')}])`
        )
      }
    }
  }

  it('every placeholder in en also exists with same name in tr', () => {
    const mismatches: string[] = []
    comparePlaceholders(enTranslations, trTranslations, 'en→tr', mismatches)
    expect(mismatches).toEqual([])
  })

  it('every placeholder in tr also exists in en (reverse direction)', () => {
    const mismatches: string[] = []
    comparePlaceholders(trTranslations, enTranslations, 'tr→en', mismatches)
    expect(mismatches).toEqual([])
  })
})

describe('i18n - LANGUAGES registry', () => {
  it('defines both English and Turkish', () => {
    expect(enTranslations).toBeDefined()
    expect(trTranslations).toBeDefined()
  })

  it('en has at least as many leaf keys as tr (en is the source of truth)', () => {
    const enCount = getLeafKeysForCheck(enTranslations).length
    const trCount = getLeafKeysForCheck(trTranslations).length
    expect(enCount).toBeGreaterThanOrEqual(trCount)
  })

  it('en and tr both have at least 100 leaf keys', () => {
    expect(getLeafKeysForCheck(enTranslations).length).toBeGreaterThanOrEqual(100)
    expect(getLeafKeysForCheck(trTranslations).length).toBeGreaterThanOrEqual(100)
  })

  it('en has at least as many keys as tr (en is the source of truth)', () => {
    const enCount = Object.keys(enTranslations).length
    const trCount = Object.keys(trTranslations).length
    expect(enCount).toBeGreaterThanOrEqual(trCount)
  })

  it('en and tr both have at least 100 keys', () => {
    expect(Object.keys(enTranslations).length).toBeGreaterThanOrEqual(100)
    expect(Object.keys(trTranslations).length).toBeGreaterThanOrEqual(100)
  })
})
