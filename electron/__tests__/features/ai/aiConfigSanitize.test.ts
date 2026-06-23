import { CONFIG_VERSION } from '@electron/features/ai/aiConfigConstants'
import { normalizeHostname, sanitizeConfig } from '@electron/features/ai/aiConfigSanitize'

import { describe, expect, it } from 'vitest'

describe('normalizeHostname', () => {
  it('should return lowercase hostname', () => {
    expect(normalizeHostname('Example.COM')).toBe('example.com')
  })

  it('should strip trailing dot', () => {
    expect(normalizeHostname('example.com.')).toBe('example.com')
  })

  it('should trim whitespace', () => {
    expect(normalizeHostname('  example.com  ')).toBe('example.com')
  })

  it('should return null for non-string input', () => {
    expect(normalizeHostname(null)).toBeNull()
    expect(normalizeHostname(undefined)).toBeNull()
    expect(normalizeHostname(123)).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(normalizeHostname('')).toBeNull()
  })

  it('should return null for hostname with slash', () => {
    expect(normalizeHostname('example.com/path')).toBeNull()
  })

  it('should return null for invalid hostname starting with dash', () => {
    expect(normalizeHostname('-example.com')).toBeNull()
  })

  it('should accept valid hostname with subdomain', () => {
    expect(normalizeHostname('sub.example.com')).toBe('sub.example.com')
  })

  it('should accept hostname with numbers', () => {
    expect(normalizeHostname('host123.example.com')).toBe('host123.example.com')
  })

  it('should return null for whitespace-only string', () => {
    expect(normalizeHostname('   ')).toBeNull()
  })
})

describe('sanitizeConfig', () => {
  it('should return null for non-object input', () => {
    expect(sanitizeConfig(null)).toBeNull()
    expect(sanitizeConfig(undefined)).toBeNull()
    expect(sanitizeConfig('string')).toBeNull()
    expect(sanitizeConfig(42)).toBeNull()
  })

  it('should return empty object for empty input (no fields to sanitize)', () => {
    expect(sanitizeConfig({})).toEqual({})
  })

  it('should return null when input is defined but invalid', () => {
    expect(sanitizeConfig({ input: 'a'.repeat(3000) })).toBeNull()
  })

  it('should return null when button is defined but invalid', () => {
    expect(sanitizeConfig({ button: 'a'.repeat(3000) })).toBeNull()
  })

  it('should sanitize a minimal valid config with input and button', () => {
    const result = sanitizeConfig({ input: '#myInput', button: '#myButton' })
    expect(result).not.toBeNull()
    expect(result!.input).toBe('#myInput')
    expect(result!.button).toBe('#myButton')
  })

  it('should set version when it matches CONFIG_VERSION', () => {
    const result = sanitizeConfig({
      version: CONFIG_VERSION,
      input: '#input',
      button: '#button'
    })
    expect(result!.version).toBe(CONFIG_VERSION)
  })

  it('should not set version when it does not match', () => {
    const result = sanitizeConfig({
      version: 999,
      input: '#input',
      button: '#button'
    })
    expect(result!.version).toBeUndefined()
  })

  it('should normalize submitMode', () => {
    const result = sanitizeConfig({
      input: '#input',
      button: '#button',
      submitMode: 'click'
    })
    expect(result!.submitMode).toBe('click')
  })

  it('should return null for invalid submitMode', () => {
    expect(
      sanitizeConfig({
        input: '#input',
        button: '#button',
        submitMode: 'invalid'
      })
    ).toBeNull()
  })

  it('should sanitize inputCandidates array', () => {
    const result = sanitizeConfig({
      input: '#input',
      button: '#button',
      inputCandidates: ['#a', '#b', '#c']
    })
    expect(result!.inputCandidates).toEqual(['#a', '#b', '#c'])
  })

  it('should deduplicate inputCandidates', () => {
    const result = sanitizeConfig({
      input: '#input',
      button: '#button',
      inputCandidates: ['#a', '#a', '#b']
    })
    expect(result!.inputCandidates).toEqual(['#a', '#b'])
  })

  it('should limit candidates to MAX_CANDIDATE_COUNT (12)', () => {
    const candidates = Array.from({ length: 20 }, (_, i) => `#c${i}`)
    const result = sanitizeConfig({
      input: '#input',
      button: '#button',
      inputCandidates: candidates
    })
    expect(result!.inputCandidates!.length).toBe(12)
  })

  it('should normalize health', () => {
    const result = sanitizeConfig({
      input: '#input',
      button: '#button',
      health: 'ready'
    })
    expect(result!.health).toBe('ready')
  })

  it('should return null for invalid health', () => {
    expect(
      sanitizeConfig({
        input: '#input',
        button: '#button',
        health: 'invalid'
      })
    ).toBeNull()
  })

  it('should sanitize sourceUrl', () => {
    const result = sanitizeConfig({
      input: '#input',
      button: '#button',
      sourceUrl: 'https://example.com/page'
    })
    expect(result!.sourceUrl).toBe('https://example.com/page')
  })

  it('should return null for invalid sourceUrl', () => {
    expect(
      sanitizeConfig({
        input: '#input',
        button: '#button',
        sourceUrl: 'not-a-url'
      })
    ).toBeNull()
  })

  it('should preserve null values for selectors', () => {
    const result = sanitizeConfig({
      input: null,
      button: null
    })
    expect(result!.input).toBeNull()
    expect(result!.button).toBeNull()
  })

  it('should strip extra whitespace from selectors', () => {
    const result = sanitizeConfig({
      input: '  #myInput  ',
      button: '  #myButton  '
    })
    expect(result!.input).toBe('#myInput')
    expect(result!.button).toBe('#myButton')
  })
})
