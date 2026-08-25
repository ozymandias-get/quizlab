import '@shared/i18n/i18next'

import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

type TranslationRecord = Record<string, unknown>

let ALL_TRANSLATIONS: Record<string, TranslationRecord> = { en: {}, tr: {} }

beforeAll(async () => {
  const enDict = i18next.getResourceBundle('en', 'translation') as TranslationRecord
  const trDict = i18next.getResourceBundle('tr', 'translation') as TranslationRecord
  ALL_TRANSLATIONS = { en: enDict, tr: trDict }
})

function getLeafKeys(obj: TranslationRecord, prefix = ''): string[] {
  let keys: string[] = []
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = [...keys, ...getLeafKeys(obj[key] as TranslationRecord, `${prefix}${key}.`)]
    } else {
      keys.push(`${prefix}${key}`)
    }
  }
  return keys
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

function extractPlaceholders(text: string): string[] {
  const matches = text.match(/{(\w+)}/g)
  return matches ? matches.map((m) => m.slice(1, -1)) : []
}

describe('i18n - Translation Completeness', () => {
  it('has both en and tr translations loaded', () => {
    expect(ALL_TRANSLATIONS.en).toBeDefined()
    expect(ALL_TRANSLATIONS.tr).toBeDefined()
    expect(Object.keys(ALL_TRANSLATIONS.en).length).toBeGreaterThan(100)
    expect(Object.keys(ALL_TRANSLATIONS.tr).length).toBeGreaterThan(100)
  })
})

describe('i18n - Key Parity Between Languages', () => {
  it('has matching leaf keys for English and Turkish', () => {
    const enKeys = getLeafKeys(ALL_TRANSLATIONS.en).sort()
    const trKeys = getLeafKeys(ALL_TRANSLATIONS.tr).sort()

    const missingInTr = enKeys.filter((key) => !trKeys.includes(key))
    const missingInEn = trKeys.filter((key) => !enKeys.includes(key))

    const errors: string[] = []
    if (missingInTr.length > 0) errors.push(`Missing in tr: ${missingInTr.join(', ')}`)
    if (missingInEn.length > 0) errors.push(`Missing in en: ${missingInEn.join(', ')}`)

    if (errors.length > 0) {
      throw new Error('\n' + errors.join('\n\n'))
    }
  })

  it('has no empty translation values', () => {
    const enKeys = getLeafKeys(ALL_TRANSLATIONS.en)
    const emptyKeys: string[] = []

    for (const key of enKeys) {
      const val = getNestedValue(ALL_TRANSLATIONS.en, key)
      if (val === '' || val === undefined) {
        emptyKeys.push(key)
      }
    }

    if (emptyKeys.length > 0) {
      throw new Error(`Empty values: ${emptyKeys.join(', ')}`)
    }
  })

  it('has no empty Turkish translation values', () => {
    const trKeys = getLeafKeys(ALL_TRANSLATIONS.tr)
    const emptyKeys: string[] = []

    for (const key of trKeys) {
      const val = getNestedValue(ALL_TRANSLATIONS.tr, key)
      if (val === '' || val === undefined) {
        emptyKeys.push(key)
      }
    }

    if (emptyKeys.length > 0) {
      throw new Error(`Empty tr values: ${emptyKeys.join(', ')}`)
    }
  })
})

describe('i18n - Interpolation Format', () => {
  it('uses single-brace format {var} everywhere (no {{var}})', () => {
    const enKeys = getLeafKeys(ALL_TRANSLATIONS.en)
    const doubleBraceKeys: string[] = []

    for (const key of enKeys) {
      const val = getNestedValue(ALL_TRANSLATIONS.en, key)
      if (typeof val === 'string' && val.includes('{{')) {
        doubleBraceKeys.push(key)
      }
    }

    if (doubleBraceKeys.length > 0) {
      throw new Error(`Double-brace found: ${doubleBraceKeys.join(', ')}`)
    }
  })

  it('has matching placeholders between en and tr for each key', () => {
    const enKeys = getLeafKeys(ALL_TRANSLATIONS.en)
    const mismatchedKeys: string[] = []

    for (const key of enKeys) {
      const enVal = getNestedValue(ALL_TRANSLATIONS.en, key)
      const trVal = getNestedValue(ALL_TRANSLATIONS.tr, key)

      if (typeof enVal === 'string' && typeof trVal === 'string') {
        const enPlaceholders = extractPlaceholders(enVal).sort()
        const trPlaceholders = extractPlaceholders(trVal).sort()

        if (JSON.stringify(enPlaceholders) !== JSON.stringify(trPlaceholders)) {
          mismatchedKeys.push(key)
        }
      }
    }

    if (mismatchedKeys.length > 0) {
      throw new Error(`Placeholder mismatch: ${mismatchedKeys.join(', ')}`)
    }
  })
})

describe('i18n - Namespace Structure', () => {
  it('has a substantial number of translation keys', () => {
    const enCount = getLeafKeys(ALL_TRANSLATIONS.en).length
    const trCount = getLeafKeys(ALL_TRANSLATIONS.tr).length
    expect(enCount).toBeGreaterThan(200)
    expect(trCount).toBeGreaterThan(200)
  })
})

describe('i18n - Translation Quality', () => {
  it('no translation value is just the key itself (untranslated)', () => {
    const enKeys = getLeafKeys(ALL_TRANSLATIONS.en)
    const untranslatedKeys: string[] = []

    for (const key of enKeys) {
      const val = getNestedValue(ALL_TRANSLATIONS.en, key)
      if (typeof val === 'string' && val === key) {
        untranslatedKeys.push(key)
      }
    }

    if (untranslatedKeys.length > 5) {
      throw new Error(
        `Possibly untranslated keys (${untranslatedKeys.length}): ${untranslatedKeys.slice(0, 10).join(', ')}`
      )
    }
  })

  it('no translation contains obvious placeholder text', () => {
    const enKeys = getLeafKeys(ALL_TRANSLATIONS.en)
    const suspiciousKeys: string[] = []
    const suspiciousPatterns = ['TODO', 'FIXME', 'XXX', 'LOREM', 'IPSUM']

    for (const key of enKeys) {
      const val = getNestedValue(ALL_TRANSLATIONS.en, key)
      if (typeof val === 'string') {
        const upper = val.toUpperCase()
        if (suspiciousPatterns.some((p) => upper.includes(p))) {
          suspiciousKeys.push(key)
        }
      }
    }

    if (suspiciousKeys.length > 0) {
      throw new Error(`Suspicious placeholder text: ${suspiciousKeys.join(', ')}`)
    }
  })

  it('no translation value is excessively long (likely copy-paste error)', () => {
    const enKeys = getLeafKeys(ALL_TRANSLATIONS.en)
    const longKeys: string[] = []

    for (const key of enKeys) {
      const val = getNestedValue(ALL_TRANSLATIONS.en, key)
      if (typeof val === 'string' && val.length > 500) {
        longKeys.push(`${key} (${val.length} chars)`)
      }
    }

    if (longKeys.length > 0) {
      throw new Error(`Excessively long translations: ${longKeys.join(', ')}`)
    }
  })
})
