import { getRecentElectronLogs } from '@electron/core/logger'
import {
  logSuppressedError,
  toErrorMessage
} from '@electron/features/gemini-web-session/sessionErrors'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalNodeEnv = process.env.NODE_ENV

describe('toErrorMessage', () => {
  it('should return message from Error instance', () => {
    expect(toErrorMessage(new Error('test error'), 'fallback')).toBe('test error')
  })

  it('should return message from TypeError', () => {
    expect(toErrorMessage(new TypeError('type error'), 'fallback')).toBe('type error')
  })

  it('should return string directly', () => {
    expect(toErrorMessage('raw error', 'fallback')).toBe('raw error')
  })

  it('should return fallback for empty string', () => {
    expect(toErrorMessage('', 'fallback')).toBe('fallback')
  })

  it('should return fallback for null', () => {
    expect(toErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('should return fallback for undefined', () => {
    expect(toErrorMessage(undefined, 'fallback')).toBe('fallback')
  })

  it('should return fallback for number', () => {
    expect(toErrorMessage(42, 'fallback')).toBe('fallback')
  })

  it('should return fallback for object', () => {
    expect(toErrorMessage({ msg: 'err' }, 'fallback')).toBe('fallback')
  })

  it('should return fallback for Error with empty message', () => {
    const err = new Error('')
    expect(toErrorMessage(err, 'fallback')).toBe('fallback')
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

  it('records a fallback message for non-Error inputs', () => {
    const lengthBefore = getRecentElectronLogs().length
    logSuppressedError('ctx', 42)
    const logs = getRecentElectronLogs()
    const last = logs[logs.length - 1]
    expect(logs.length).toBe(lengthBefore + 1)
    expect(last?.message).toContain('unknown_error')
  })

  it('records a fallback message for null', () => {
    const lengthBefore = getRecentElectronLogs().length
    logSuppressedError('ctx', null)
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
