import { describe, expect, it } from 'vitest'
import {
  cloneScriptDiagnostics,
  normalizeExecutionResult
} from '@features/ai/lib/send/scriptExecution'

describe('scriptExecution', () => {
  it('normalizes boolean execution result', () => {
    expect(normalizeExecutionResult(true)).toEqual({ success: true })
    expect(normalizeExecutionResult(false)).toEqual({ success: false })
  })

  it('normalizes object execution result with fallback success', () => {
    const normalized = normalizeExecutionResult({ mode: 'click' })
    expect(normalized).toEqual({
      success: true,
      error: undefined,
      mode: 'click',
      action: undefined,
      diagnostics: undefined
    })
  })

  it('returns null for invalid result shapes', () => {
    expect(normalizeExecutionResult(null)).toBeNull()
    expect(normalizeExecutionResult('bad')).toBeNull()
  })

  it('clones script diagnostics deeply', () => {
    const input = {
      kind: 'auto_send',
      totalMs: 12,
      input: { strategy: 'direct' }
    } as any

    const cloned = cloneScriptDiagnostics(input)
    expect(cloned).toEqual(input)
    expect(cloned).not.toBe(input)
    expect(cloned?.input).not.toBe(input.input)
  })
})
