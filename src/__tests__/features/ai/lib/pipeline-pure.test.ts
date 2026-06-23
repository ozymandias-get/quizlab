/**
 * Tests for small, focused AI send pipeline utilities.
 * - apiChatUtils.isVisionCapable — model name pattern matching
 * - sendDiagnostics — nowMs / roundMs / createSendDiagnostics / attachDiagnostics
 * - scriptExecution — normalizeExecutionResult / cloneScriptDiagnostics
 *
 * These are pure functions called from many call sites. Regressions here
 * surface as broken image uploads, broken timing reports, or broken
 * script result interpretation.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { isVisionCapable, VISION_MODEL_PATTERNS } from '../../../../features/ai/lib/apiChatUtils'
import {
  cloneScriptDiagnostics,
  normalizeExecutionResult
} from '../../../../features/ai/lib/send/scriptExecution'
import {
  attachDiagnostics,
  createSendDiagnostics,
  nowMs,
  roundMs
} from '../../../../features/ai/lib/send/sendDiagnostics'

describe('isVisionCapable', () => {
  it('returns true for GPT-4o models', () => {
    expect(isVisionCapable('gpt-4o')).toBe(true)
    expect(isVisionCapable('gpt-4o-mini')).toBe(true)
    expect(isVisionCapable('GPT-4o-VISION')).toBe(true)
  })

  it('returns true for GPT-4.x-turbo', () => {
    expect(isVisionCapable('gpt-4-turbo')).toBe(true)
    expect(isVisionCapable('gpt-4-1106-turbo')).toBe(true)
    expect(isVisionCapable('gpt-4.1-turbo')).toBe(true)
  })

  it('returns true for Claude 3.5 and 3 Opus', () => {
    expect(isVisionCapable('claude-3-5-sonnet')).toBe(true)
    expect(isVisionCapable('claude-3-opus-20240229')).toBe(true)
    expect(isVisionCapable('claude-3-5-haiku-latest')).toBe(true)
  })

  it('returns true for Gemini 1.5/2.x', () => {
    expect(isVisionCapable('gemini-1.5-pro')).toBe(true)
    expect(isVisionCapable('gemini-1.5-flash')).toBe(true)
    expect(isVisionCapable('gemini-2.0-flash')).toBe(true)
  })

  it('returns false for non-vision models', () => {
    expect(isVisionCapable('gpt-3.5-turbo')).toBe(false)
    expect(isVisionCapable('text-davinci-003')).toBe(false)
    expect(isVisionCapable('claude-2')).toBe(false)
    expect(isVisionCapable('gemini-pro')).toBe(false)
  })

  it('returns false for empty / weird inputs', () => {
    expect(isVisionCapable('')).toBe(false)
    expect(isVisionCapable('unknown-model')).toBe(false)
  })

  it('VISION_MODEL_PATTERNS is non-empty', () => {
    expect(VISION_MODEL_PATTERNS.length).toBeGreaterThan(0)
  })
})

describe('nowMs', () => {
  beforeEach(() => {
    // jsdom provides performance.now
  })

  it('returns a number', () => {
    expect(typeof nowMs()).toBe('number')
  })

  it('returns a non-negative value', () => {
    expect(nowMs()).toBeGreaterThanOrEqual(0)
  })

  it('falls back to Date.now when performance.now is missing', () => {
    const original = (globalThis as any).performance
    // Remove performance.now
    ;(globalThis as any).performance = { now: undefined }
    try {
      const t = nowMs()
      expect(typeof t).toBe('number')
      // Date.now() is a timestamp (likely huge number)
      expect(t).toBeGreaterThan(0)
    } finally {
      ;(globalThis as any).performance = original
    }
  })
})

describe('roundMs', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMs(1.234)).toBe(1.23)
    expect(roundMs(1.236)).toBe(1.24) // standard rounding
    // Note: values at exact half-boundaries (1.005, 1.015, 1.025, 1.035, 1.045)
    // are skipped — IEEE 754 cannot represent them exactly, so the rounding
    // direction depends on the nearest float, not the decimal intent. The
    // function does "round half away from zero" only at exact representable
    // boundaries; at non-representable boundaries, the floating-point value
    // wins. See: https://stackoverflow.com/q/588004
    expect(roundMs(1.2344)).toBe(1.23) // below half
    expect(roundMs(1.2346)).toBe(1.23) // below half after float wobble
  })

  it('handles whole numbers', () => {
    expect(roundMs(100)).toBe(100)
    expect(roundMs(0)).toBe(0)
  })

  it('handles negative values', () => {
    expect(roundMs(-1.234)).toBe(-1.23)
  })
})

describe('createSendDiagnostics', () => {
  it('returns an object with pipeline, currentAI, autoSend, and zeroed timings', () => {
    const d = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'chatgpt',
      autoSend: true
    })
    expect(d.pipeline).toBe('text')
    expect(d.currentAI).toBe('chatgpt')
    expect(d.autoSend).toBe(true)
    expect(d.timings).toEqual({
      queueWaitMs: 0,
      configResolveMs: 0,
      totalMs: 0
    })
  })

  it('passes through activeTabId when provided', () => {
    const d = createSendDiagnostics({
      pipeline: 'image',
      currentAI: 'gemini',
      activeTabId: 'tab-123',
      autoSend: false
    })
    expect(d.tabId).toBe('tab-123')
  })

  it('leaves tabId undefined when not provided', () => {
    const d = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'claude',
      autoSend: false
    })
    expect(d.tabId).toBeUndefined()
  })
})

describe('attachDiagnostics', () => {
  it('merges diagnostics into a result and finalizes totalMs', () => {
    const d = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'chatgpt',
      autoSend: true
    })
    const result = { success: true } as any
    const out = attachDiagnostics(result, d, Date.now())
    expect(out.success).toBe(true)
    expect(out.diagnostics).toBeDefined()
    // totalMs is finalized (set to roundMs(nowMs() - startedAt))
    expect(typeof out.diagnostics.timings.totalMs).toBe('number')
  })

  it('preserves all original result fields', () => {
    const d = createSendDiagnostics({
      pipeline: 'image',
      currentAI: 'gemini',
      autoSend: false
    })
    const result = {
      success: false,
      error: 'some_error',
      mode: 'image',
      action: 'paste'
    } as any
    const out = attachDiagnostics(result, d, Date.now())
    expect(out.error).toBe('some_error')
    expect(out.mode).toBe('image')
    expect(out.action).toBe('paste')
    expect(out.diagnostics).toBeDefined()
  })
})

describe('normalizeExecutionResult', () => {
  it('converts a boolean to a { success } object', () => {
    expect(normalizeExecutionResult(true)).toEqual({ success: true })
    expect(normalizeExecutionResult(false)).toEqual({ success: false })
  })

  it('returns null for null / undefined / non-objects', () => {
    expect(normalizeExecutionResult(null)).toBeNull()
    expect(normalizeExecutionResult(undefined)).toBeNull()
    expect(normalizeExecutionResult(42)).toBeNull()
    expect(normalizeExecutionResult('string')).toBeNull()
  })

  it('extracts success from an object that has a boolean success', () => {
    expect(normalizeExecutionResult({ success: true })).toEqual({ success: true })
    expect(normalizeExecutionResult({ success: false, error: 'boom' })).toEqual({
      success: false,
      error: 'boom'
    })
  })

  it('infers success=true from an object with no error', () => {
    const out = normalizeExecutionResult({ mode: 'paste', action: 'submit' })
    expect(out?.success).toBe(true)
    expect(out?.mode).toBe('paste')
    expect(out?.action).toBe('submit')
  })

  it('infers success=false from an object that has an error but no success field', () => {
    const out = normalizeExecutionResult({ error: 'something_went_wrong' })
    expect(out?.success).toBe(false)
    expect(out?.error).toBe('something_went_wrong')
  })

  it('preserves diagnostics field', () => {
    const diags = { duration: 100, steps: 3 }
    const out = normalizeExecutionResult({ success: true, diagnostics: diags })
    expect(out?.diagnostics).toBe(diags)
  })
})

describe('cloneScriptDiagnostics', () => {
  it('returns null for null / undefined', () => {
    expect(cloneScriptDiagnostics(null)).toBeNull()
    expect(cloneScriptDiagnostics(undefined)).toBeNull()
  })

  it('produces a deep clone of diagnostics', () => {
    const diags: any = {
      duration: 100,
      steps: ['a', 'b'],
      nested: { key: 'value' }
    }
    const cloned = cloneScriptDiagnostics(diags)
    expect(cloned).toEqual(diags)
    expect(cloned).not.toBe(diags)
    expect((cloned as any)?.nested).not.toBe(diags.nested)
  })

  it('survives modifications of the clone', () => {
    const diags: any = { duration: 100, meta: { count: 1 } }
    const cloned = cloneScriptDiagnostics(diags)
    if (cloned && (cloned as any).meta) {
      ;(cloned as any).meta.count = 999
    }
    expect(diags.meta.count).toBe(1)
  })
})
