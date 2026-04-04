import { describe, it, expect } from 'vitest'
import enTranslations from '../shared/i18n/locales/en.json'
import trTranslations from '../shared/i18n/locales/tr.json'

type TranslationRecord = Record<string, unknown>

function getKeys(obj: TranslationRecord, prefix = ''): string[] {
  let keys: string[] = []
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getKeys(obj[key] as TranslationRecord, `${prefix}${key}.`))
    } else {
      keys.push(`${prefix}${key}`)
    }
  }
  return keys
}

describe('i18n Translations', () => {
  it('should have matching keys for English and Turkish', () => {
    const enKeys = getKeys(enTranslations).sort()
    const trKeys = getKeys(trTranslations).sort()

    // Find missing keys in each
    const missingInTr = enKeys.filter((key) => !trKeys.includes(key))
    const missingInEn = trKeys.filter((key) => !enKeys.includes(key))

    const errors: string[] = []

    if (missingInTr.length > 0) {
      errors.push(`Missing keys in tr.json: ${missingInTr.join(', ')}`)
    }

    if (missingInEn.length > 0) {
      errors.push(`Missing keys in en.json: ${missingInEn.join(', ')}`)
    }

    if (errors.length > 0) {
      throw new Error('\n' + errors.join('\n\n'))
    }

    expect(missingInTr.length).toBe(0)
    expect(missingInEn.length).toBe(0)
  })
})
