/**
 * Tests for shared/selectorConfig.ts — pure functions used by both the
 * AI sender pipeline and the Settings selectors UI. Critical because a
 * bad normalization here cascades into silently-broken automation scripts.
 */
import { describe, expect, it } from 'vitest'

import {
  canonicalizeHostname,
  normalizeSelectorHealth,
  normalizeSubmitMode,
  toAutomationConfig
} from '../../../shared/selectorConfig'

describe('normalizeSubmitMode', () => {
  it('returns undefined for non-strings', () => {
    expect(normalizeSubmitMode(null)).toBeUndefined()
    expect(normalizeSubmitMode(undefined)).toBeUndefined()
    expect(normalizeSubmitMode(123)).toBeUndefined()
    expect(normalizeSubmitMode({})).toBeUndefined()
    expect(normalizeSubmitMode([])).toBeUndefined()
    expect(normalizeSubmitMode(true)).toBeUndefined()
  })

  it('returns undefined for empty / whitespace-only strings', () => {
    expect(normalizeSubmitMode('')).toBeUndefined()
    expect(normalizeSubmitMode('   ')).toBeUndefined()
    expect(normalizeSubmitMode('\t\n')).toBeUndefined()
  })

  it('maps "enter" → "enter_key"', () => {
    expect(normalizeSubmitMode('enter')).toBe('enter_key')
  })

  it('accepts "enter_key" verbatim', () => {
    expect(normalizeSubmitMode('enter_key')).toBe('enter_key')
  })

  it('accepts "click" verbatim', () => {
    expect(normalizeSubmitMode('click')).toBe('click')
  })

  it('accepts "mixed" verbatim', () => {
    expect(normalizeSubmitMode('mixed')).toBe('mixed')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeSubmitMode('  ENTER  ')).toBe('enter_key')
    expect(normalizeSubmitMode('Click')).toBe('click')
    expect(normalizeSubmitMode('MIXED')).toBe('mixed')
  })

  it('returns undefined for unknown values', () => {
    expect(normalizeSubmitMode('shift_enter')).toBeUndefined()
    expect(normalizeSubmitMode('ctrl_enter')).toBeUndefined()
    expect(normalizeSubmitMode('auto')).toBeUndefined()
    expect(normalizeSubmitMode('submit')).toBeUndefined()
  })
})

describe('canonicalizeHostname', () => {
  it('returns null for non-strings', () => {
    expect(canonicalizeHostname(null)).toBeNull()
    expect(canonicalizeHostname(undefined)).toBeNull()
    expect(canonicalizeHostname(123)).toBeNull()
    expect(canonicalizeHostname({})).toBeNull()
  })

  it('returns null for empty / whitespace', () => {
    expect(canonicalizeHostname('')).toBeNull()
    expect(canonicalizeHostname('   ')).toBeNull()
  })

  it('lowercases the input', () => {
    expect(canonicalizeHostname('ChatGPT.com')).toBe('chatgpt.com')
    expect(canonicalizeHostname('EXAMPLE.NET')).toBe('example.net')
  })

  it('strips trailing dot', () => {
    expect(canonicalizeHostname('example.com.')).toBe('example.com')
  })

  it('returns simple 2-label hostnames as-is', () => {
    expect(canonicalizeHostname('example.com')).toBe('example.com')
    expect(canonicalizeHostname('a.io')).toBe('a.io')
  })

  it('strips known prefixes (www, app, chat)', () => {
    expect(canonicalizeHostname('www.example.com')).toBe('example.com')
    expect(canonicalizeHostname('app.example.com')).toBe('example.com')
    expect(canonicalizeHostname('chat.example.com')).toBe('example.com')
  })

  it('does not strip a prefix when only 2 labels remain without it', () => {
    // www.example — the host is genuinely www.example
    expect(canonicalizeHostname('www.example')).toBe('www.example')
  })

  it('strips a prefix repeatedly if nested', () => {
    expect(canonicalizeHostname('www.chat.example.com')).toBe('example.com')
    expect(canonicalizeHostname('app.www.example.com')).toBe('example.com')
  })

  it('preserves ccTLDs (e.g. .co.uk, .com.tr, .com.au)', () => {
    // UK: 2-letter TLD + co.uk → keep 3 labels
    expect(canonicalizeHostname('www.bbc.co.uk')).toBe('bbc.co.uk')
    expect(canonicalizeHostname('chat.example.co.uk')).toBe('example.co.uk')

    // Turkish co.uk equivalent (com.tr)
    expect(canonicalizeHostname('app.example.com.tr')).toBe('example.com.tr')

    // .com.au — 2-letter TLD with com in the registrable suffixes list
    expect(canonicalizeHostname('www.example.com.au')).toBe('example.com.au')
  })

  it('handles 2-letter ccTLDs (e.g. .de, .fr)', () => {
    expect(canonicalizeHostname('example.de')).toBe('example.de')
    expect(canonicalizeHostname('www.example.de')).toBe('example.de')
  })

  it('returns last 2 labels for unrecognised patterns', () => {
    expect(canonicalizeHostname('a.b.c.d.example.org')).toBe('example.org')
    expect(canonicalizeHostname('deeply.nested.subdomain.io')).toBe('subdomain.io')
  })

  it('handles bare hostnames (no TLD)', () => {
    expect(canonicalizeHostname('localhost')).toBe('localhost')
  })
})

describe('normalizeSelectorHealth', () => {
  it('accepts "ready"', () => {
    expect(normalizeSelectorHealth('ready')).toBe('ready')
  })

  it('accepts "migrated"', () => {
    expect(normalizeSelectorHealth('migrated')).toBe('migrated')
  })

  it('accepts "needs_repick"', () => {
    expect(normalizeSelectorHealth('needs_repick')).toBe('needs_repick')
  })

  it('returns undefined for invalid values', () => {
    expect(normalizeSelectorHealth('unknown')).toBeUndefined()
    expect(normalizeSelectorHealth('READY')).toBeUndefined() // case sensitive
    expect(normalizeSelectorHealth('')).toBeUndefined()
  })

  it('returns undefined for non-strings', () => {
    expect(normalizeSelectorHealth(null)).toBeUndefined()
    expect(normalizeSelectorHealth(undefined)).toBeUndefined()
    expect(normalizeSelectorHealth(123)).toBeUndefined()
  })
})

describe('toAutomationConfig', () => {
  it('coerces a loose AiSelectorConfig into a strict AutomationConfig', () => {
    const result = toAutomationConfig({
      version: 2,
      input: 'textarea',
      button: 'button.send',
      waitFor: '.response',
      submitMode: 'enter',
      inputCandidates: ['textarea', 'div[contenteditable]'],
      buttonCandidates: ['button.send', 'button[type=submit]'],
      inputFingerprint: 'abc',
      buttonFingerprint: 'def',
      sourceUrl: 'https://example.com/',
      sourceHostname: 'www.example.com',
      canonicalHostname: 'example.com',
      health: 'ready'
    } as any)
    expect(result.version).toBe(2)
    expect(result.input).toBe('textarea')
    expect(result.button).toBe('button.send')
    expect(result.waitFor).toBe('.response')
    expect(result.submitMode).toBe('enter_key') // 'enter' gets normalized
    expect(result.inputCandidates).toEqual(['textarea', 'div[contenteditable]'])
    expect(result.buttonCandidates).toEqual(['button.send', 'button[type=submit]'])
    expect(result.inputFingerprint).toBe('abc')
    expect(result.buttonFingerprint).toBe('def')
    expect(result.sourceUrl).toBe('https://example.com/')
    expect(result.sourceHostname).toBe('www.example.com')
    expect(result.canonicalHostname).toBe('example.com')
    expect(result.health).toBe('ready')
  })

  it('sets version to undefined for non-2 versions', () => {
    expect(toAutomationConfig({ version: 1 } as any).version).toBeUndefined()
    expect(toAutomationConfig({ version: 3 } as any).version).toBeUndefined()
    expect(toAutomationConfig({ version: '2' } as any).version).toBeUndefined()
  })

  it('nulls out non-string input/button/waitFor', () => {
    expect(toAutomationConfig({ input: 123 } as any).input).toBeNull()
    expect(toAutomationConfig({ button: { sel: 'x' } } as any).button).toBeNull()
    expect(toAutomationConfig({ waitFor: ['a', 'b'] } as any).waitFor).toBeNull()
  })

  it('preserves null strings for input/button/waitFor', () => {
    expect(toAutomationConfig({ input: null } as any).input).toBeNull()
    expect(toAutomationConfig({ button: null } as any).button).toBeNull()
    expect(toAutomationConfig({ waitFor: null } as any).waitFor).toBeNull()
  })

  it('nulls out non-array candidate fields', () => {
    expect(toAutomationConfig({ inputCandidates: 'not-array' } as any).inputCandidates).toBeNull()
    expect(toAutomationConfig({ buttonCandidates: { 0: 'a' } } as any).buttonCandidates).toBeNull()
  })

  it('nulls out missing fingerprints', () => {
    expect(toAutomationConfig({} as any).inputFingerprint).toBeNull()
    expect(toAutomationConfig({} as any).buttonFingerprint).toBeNull()
  })

  it('nulls out non-string sourceUrl / sourceHostname / canonicalHostname', () => {
    expect(toAutomationConfig({ sourceUrl: 123 } as any).sourceUrl).toBeNull()
    expect(toAutomationConfig({ sourceHostname: false } as any).sourceHostname).toBeNull()
    expect(toAutomationConfig({ canonicalHostname: [] } as any).canonicalHostname).toBeNull()
  })

  it('leaves health as-is (any value is allowed in toAutomationConfig)', () => {
    // normalizeSelectorHealth is only applied at consumption; the config
    // here is the loose "saved" form. The runtime consumer validates.
    expect(toAutomationConfig({ health: 'ready' } as any).health).toBe('ready')
    expect(toAutomationConfig({ health: 'whatever' } as any).health).toBe('whatever')
  })

  it('submitMode is normalized to undefined for invalid values', () => {
    expect(toAutomationConfig({ submitMode: 'invalid' } as any).submitMode).toBeUndefined()
    expect(toAutomationConfig({ submitMode: null } as any).submitMode).toBeUndefined()
    expect(toAutomationConfig({ submitMode: 1 } as any).submitMode).toBeUndefined()
  })

  it('handles a completely empty input', () => {
    const result = toAutomationConfig({} as any)
    expect(result).toEqual({
      version: undefined,
      input: null,
      button: null,
      waitFor: null,
      submitMode: undefined,
      inputCandidates: null,
      buttonCandidates: null,
      inputFingerprint: null,
      buttonFingerprint: null,
      sourceUrl: null,
      sourceHostname: null,
      canonicalHostname: null,
      health: undefined
    })
  })
})
