import { getRecentElectronLogs } from '@electron/core/logger'
import {
  logSuppressedError,
  toErrorMessage
} from '@electron/features/gemini-web-session/sessionErrors'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalNodeEnv = process.env.NODE_ENV

// toErrorMessage has exactly three branches: an Error with a message, a
// non-empty string, and the fallback. The nine former one-assertion-per-input
// tests were one behaviour each for the same three outcomes.
describe('toErrorMessage', () => {
  it.each([
    ['an Error', new Error('test error'), 'test error'],
    ['a TypeError', new TypeError('type error'), 'type error']
  ])('returns the message of %s', (_label, error, expected) => {
    expect(toErrorMessage(error, 'fallback')).toBe(expected)
  })

  it('returns a non-empty string directly', () => {
    expect(toErrorMessage('raw error', 'fallback')).toBe('raw error')
  })

  it.each([
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a plain object', { msg: 'err' }],
    ['an Error with an empty message', new Error('')]
  ])('returns the fallback for %s', (_label, error) => {
    expect(toErrorMessage(error, 'fallback')).toBe('fallback')
  })
})

describe('logSuppressedError', () => {
  beforeEach(() => {
    // Vitest runs with NODE_ENV=test which evaluates `isDev` to false
    // (matches production behaviour: no console output, only buffer).
    process.env.NODE_ENV = 'production'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    vi.restoreAllMocks()
  })

  it('records an entry in the shared log buffer for an Error cause', () => {
    const lengthBefore = getRecentElectronLogs().length

    logSuppressedError('testContext', new Error('test msg'))

    const logs = getRecentElectronLogs()
    const last = logs[logs.length - 1]
    expect(logs.length).toBe(lengthBefore + 1)
    expect(last).toMatchObject({ level: 'info' })
    expect(last.message).toContain('geminiWebSession.testContext')
    expect(last.message).toContain('test msg')
  })

  it.each([
    ['a number', 42],
    ['null', null]
  ])('records a fallback message for %s', (_label, error) => {
    const lengthBefore = getRecentElectronLogs().length
    logSuppressedError('ctx', error)
    const logs = getRecentElectronLogs()
    const last = logs[logs.length - 1]
    expect(logs.length).toBe(lengthBefore + 1)
    expect(last?.message).toContain('unknown_error')
  })

  it('does not call console.warn (only console.debug in dev)', () => {
    logSuppressedError('no.warn.ctx', new Error('msg'))
    expect(console.warn).not.toHaveBeenCalled()
  })
})
