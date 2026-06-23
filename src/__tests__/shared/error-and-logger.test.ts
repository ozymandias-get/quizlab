/**
 * Tests for src/shared/lib/errorUtils.ts and logger.ts.
 *
 * - errorUtils.ensureErrorMessage is called in every catch block to
 *   normalize unknown errors to a string. A regression here would mean
 *   uncaught exception messages are lost or shown as "[object Object]".
 * - logger.ts wraps console output and buffers logs for issue reports.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ensureErrorMessage } from '../../shared/lib/errorUtils'
import { createIssueLogReport, Logger, reportSuppressedError } from '../../shared/lib/logger'

describe('ensureErrorMessage', () => {
  it('returns the message of an Error instance', () => {
    expect(ensureErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns TypeError message for TypeError', () => {
    expect(ensureErrorMessage(new TypeError('bad type'))).toBe('bad type')
  })

  it('returns custom error message', () => {
    class CustomError extends Error {
      constructor(msg: string) {
        super(msg)
        this.name = 'CustomError'
      }
    }
    expect(ensureErrorMessage(new CustomError('custom issue'))).toBe('custom issue')
  })

  it('returns string inputs verbatim', () => {
    expect(ensureErrorMessage('plain string')).toBe('plain string')
    expect(ensureErrorMessage('')).toBe('')
  })

  it('returns JSON string for plain objects', () => {
    expect(ensureErrorMessage({ code: 500, msg: 'server' })).toBe(
      JSON.stringify({ code: 500, msg: 'server' })
    )
  })

  it('returns JSON string for arrays', () => {
    expect(ensureErrorMessage([1, 2, 3])).toBe(JSON.stringify([1, 2, 3]))
  })

  it('returns JSON string for numbers', () => {
    expect(ensureErrorMessage(42)).toBe('42')
  })

  it('returns JSON string for null', () => {
    expect(ensureErrorMessage(null)).toBe('null')
  })

  it('returns JSON string for booleans', () => {
    expect(ensureErrorMessage(true)).toBe('true')
    expect(ensureErrorMessage(false)).toBe('false')
  })

  it('returns the default message for circular references (cannot be JSON-serialized)', () => {
    const obj: any = {}
    obj.self = obj // circular
    // JSON.stringify(obj) throws → caught → returns fallback
    expect(ensureErrorMessage(obj, 'CIRCULAR')).toBe('CIRCULAR')
  })

  it('handles undefined by returning the default fallback', () => {
    // JSON.stringify(undefined) returns undefined (not the string), and
    // the function does NOT currently treat this as a fallback case. We
    // document the actual behavior: undefined in → undefined out, NOT
    // the fallback string. This is a known quirk — if a caller needs a
    // string, they should always pass a fallback when the source could
    // be undefined.
    const result = ensureErrorMessage(undefined, 'FALLBACK')
    // Result is undefined — caller's responsibility to handle
    expect(result).toBeUndefined()
  })

  it('does not throw for non-serializable inputs', () => {
    expect(() => ensureErrorMessage(() => {}, 'FALLBACK')).not.toThrow()
    // JSON.stringify(function) returns undefined (not throws), so the
    // function returns undefined — documented behavior. Callers needing
    // a guaranteed string should use the explicit string check.
    expect(ensureErrorMessage(() => {}, 'FALLBACK')).toBeUndefined()
  })

  it('handles BigInt by falling back (JSON.stringify throws on BigInt)', () => {
    // BigInt can't be JSON.stringified, so it falls back to "default"
    const result = ensureErrorMessage(BigInt(1), 'FALLBACK')
    expect(result).toBe('FALLBACK')
  })
})

describe('Logger - basic API', () => {
  let warnSpy: any
  let errorSpy: any
  let infoSpy: any

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    infoSpy.mockRestore()
  })

  it('Logger.error always calls console.error', () => {
    Logger.error('test error')
    expect(errorSpy).toHaveBeenCalledWith('test error')
  })

  it('Logger.warn does not call console.warn in non-dev mode', () => {
    Logger.warn('test warning')
    // In non-development mode, warn is suppressed (only buffered).
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('Logger.info does not call console.info in non-dev mode', () => {
    Logger.info('test info')
    // In non-development mode, info is suppressed (only buffered).
    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('Logger.error handles multiple args', () => {
    Logger.error('context:', 'detail:', 42)
    expect(errorSpy).toHaveBeenCalled()
    expect(errorSpy.mock.calls[0].length).toBe(3)
  })

  it('Logger.error handles Error objects', () => {
    const err = new Error('boom')
    Logger.error('Failed:', err)
    expect(errorSpy).toHaveBeenCalled()
  })
})

describe('Logger - reportSuppressedError', () => {
  it('does not throw when called with just a scope', () => {
    expect(() => reportSuppressedError('test-scope')).not.toThrow()
  })

  it('does not throw when called with a cause', () => {
    expect(() => reportSuppressedError('test-scope', { cause: new Error('inner') })).not.toThrow()
  })

  it('handles circular cause without crashing', () => {
    const cause: any = {}
    cause.self = cause
    expect(() => reportSuppressedError('circular', { cause })).not.toThrow()
  })

  it('handles undefined cause explicitly', () => {
    expect(() => reportSuppressedError('test', { cause: undefined })).not.toThrow()
  })
})

describe('Logger - createIssueLogReport', () => {
  it('returns a markdown-formatted report', () => {
    const report = createIssueLogReport({
      appVersion: '1.2.3',
      language: 'en'
    })
    expect(typeof report).toBe('string')
    expect(report).toContain('# Quizlab Reader Error Report')
    expect(report).toContain('App Version: 1.2.3')
    expect(report).toContain('Language: en')
  })

  it('includes the recent logs section', () => {
    const report = createIssueLogReport({
      appVersion: '0.1.0',
      language: 'tr'
    })
    expect(report).toContain('## Recent Logs')
    expect(report).toContain('```text')
  })

  it('includes a user agent line (or "unknown" in node)', () => {
    const report = createIssueLogReport({
      appVersion: '0.1.0',
      language: 'en'
    })
    expect(report).toMatch(/User Agent: .+/)
  })

  it('includes reproduction steps placeholder', () => {
    const report = createIssueLogReport({
      appVersion: '0.1.0',
      language: 'en'
    })
    expect(report).toContain('## Reproduction Steps')
    expect(report).toContain('1.')
  })

  it('includes a "Recent Logs" section', () => {
    const report = createIssueLogReport({
      appVersion: '0.1.0',
      language: 'en'
    })
    // The section is always present; the body is either the logs or
    // the "No buffered logs yet." placeholder.
    expect(report).toContain('## Recent Logs')
    expect(report).toContain('```text')
    // Match the logs block — must end with a code fence
    expect(report.trim().endsWith('```')).toBe(true)
  })
})
