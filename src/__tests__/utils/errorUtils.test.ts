import { describe, it, expect } from 'vitest'
import { ensureErrorMessage } from '@shared/lib/errorUtils'

describe('ensureErrorMessage', () => {
  it('should return error message for instances of Error', () => {
    const error = new Error('Test error message')
    expect(ensureErrorMessage(error)).toBe('Test error message')
  })

  it('should return the string itself if the input is a string', () => {
    expect(ensureErrorMessage('String error')).toBe('String error')
  })

  it('should JSON stringify arbitrary objects', () => {
    const obj = { code: 404, type: 'not_found' }
    expect(ensureErrorMessage(obj)).toBe(JSON.stringify(obj))
  })

  it('should return fallback if JSON stringify throws (e.g. circular references)', () => {
    const circular: any = {}
    circular.self = circular
    expect(ensureErrorMessage(circular, 'Custom fallback')).toBe('Custom fallback')
    expect(ensureErrorMessage(circular)).toBe('Unknown error')
  })
})
