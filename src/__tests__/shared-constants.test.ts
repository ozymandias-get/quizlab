/**
 * Tests for the shared constants modules.
 * - DEFAULT_PROMPTS: id uniqueness, language pairing, text content sanity
 * - STORAGE_KEYS: stability (no renames), uniqueness, used-by audit
 */
import { describe, expect, it } from 'vitest'

import { DEFAULT_PROMPTS } from '../shared/constants/prompts'
import { STORAGE_KEYS } from '../shared/constants/storageKeys'

describe('DEFAULT_PROMPTS - structure', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_PROMPTS)).toBe(true)
    expect(DEFAULT_PROMPTS.length).toBeGreaterThan(0)
  })

  it('every entry has id and text properties of correct types', () => {
    for (const p of DEFAULT_PROMPTS) {
      expect(typeof p.id).toBe('string')
      expect(typeof p.text).toBe('string')
      expect(p.id.length).toBeGreaterThan(0)
      expect(p.text.length).toBeGreaterThan(0)
    }
  })

  it('ids are unique (no duplicates)', () => {
    const ids = DEFAULT_PROMPTS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ids do not exceed a reasonable length', () => {
    for (const p of DEFAULT_PROMPTS) {
      expect(p.id.length).toBeLessThanOrEqual(64)
    }
  })

  it('texts are at least 30 characters (real instructions, not stubs)', () => {
    for (const p of DEFAULT_PROMPTS) {
      expect(p.text.length).toBeGreaterThan(30)
    }
  })
})

describe('DEFAULT_PROMPTS - language pairing', () => {
  function idsEndingWith(suffix: string): string[] {
    return DEFAULT_PROMPTS.filter((p) => p.id.endsWith(suffix)).map((p) => p.id)
  }

  it('every _tr prompt has a matching _en prompt (parity)', () => {
    const trIds = idsEndingWith('_tr')
    expect(trIds.length).toBeGreaterThan(0)
    for (const trId of trIds) {
      const enId = trId.replace(/_tr$/, '_en')
      expect(
        DEFAULT_PROMPTS.some((p) => p.id === enId),
        `Missing English counterpart for ${trId} (expected ${enId})`
      ).toBe(true)
    }
  })

  it('every _en prompt has a matching _tr prompt (parity reverse)', () => {
    const enIds = idsEndingWith('_en')
    expect(enIds.length).toBeGreaterThan(0)
    for (const enId of enIds) {
      const trId = enId.replace(/_en$/, '_tr')
      expect(
        DEFAULT_PROMPTS.some((p) => p.id === trId),
        `Missing Turkish counterpart for ${enId} (expected ${trId})`
      ).toBe(true)
    }
  })

  it('every non-language-suffixed id is the same in both languages', () => {
    // A prompt without _tr or _en suffix would be a bug — should be paired.
    const unpaired = DEFAULT_PROMPTS.filter((p) => !p.id.endsWith('_tr') && !p.id.endsWith('_en'))
    expect(unpaired).toEqual([])
  })
})

describe('DEFAULT_PROMPTS - content sanity', () => {
  it('texts do not contain placeholder syntax that is never interpolated', () => {
    // The app uses {variable} syntax for substitution; if a prompt has
    // unmatched braces it would render literally. Allow { } in natural
    // contexts (e.g. "1. {x}") but flag the suspicious double-brace.
    for (const p of DEFAULT_PROMPTS) {
      expect(p.text).not.toMatch(/{{/)
      expect(p.text).not.toMatch(/}}/)
    }
  })

  it('texts do not include unresolved template tokens like {undefined}', () => {
    for (const p of DEFAULT_PROMPTS) {
      expect(p.text).not.toContain('{undefined}')
      expect(p.text).not.toContain('{null}')
    }
  })

  it('texts do not have leading/trailing whitespace', () => {
    for (const p of DEFAULT_PROMPTS) {
      expect(p.text).toBe(p.text.trim())
    }
  })
})

describe('STORAGE_KEYS - structural invariants', () => {
  it('is a non-null object', () => {
    expect(typeof STORAGE_KEYS).toBe('object')
  })

  it('has at least 10 keys defined', () => {
    expect(Object.keys(STORAGE_KEYS).length).toBeGreaterThanOrEqual(10)
  })

  it('all values are non-empty strings', () => {
    for (const [k, v] of Object.entries(STORAGE_KEYS)) {
      expect(typeof v, `STORAGE_KEYS.${k} should be a string`).toBe('string')
      expect(v.length, `STORAGE_KEYS.${k} should not be empty`).toBeGreaterThan(0)
    }
  })

  it('all values are unique (no two keys share a storage name)', () => {
    const vals = Object.values(STORAGE_KEYS)
    expect(new Set(vals).size).toBe(vals.length)
  })
})

describe('STORAGE_KEYS - required fields present', () => {
  it('exposes the canonical app-level keys the codebase uses', () => {
    // This is a regression guard: if any of these are renamed, any code
    // reading the storage will break. The list mirrors the public contract.
    const required = [
      'LEFT_PANEL_WIDTH',
      'LAST_SELECTED_AI',
      'AUTO_SEND_ENABLED',
      'ENABLED_MODELS',
      'DEFAULT_AI_MODEL',
      'APP_LANGUAGE',
      'CUSTOM_PROMPTS',
      'SELECTED_PROMPT_ID',
      'LAST_PDF_READING'
    ]
    for (const r of required) {
      expect(STORAGE_KEYS, `STORAGE_KEYS.${r} should be defined`).toHaveProperty(r)
    }
  })
})
