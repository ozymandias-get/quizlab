import {
  attachDiagnostics,
  createSendDiagnostics,
  nowMs,
  roundMs
} from '@features/ai/lib/send/sendDiagnostics'

import { describe, expect, it } from 'vitest'

describe('nowMs', () => {
  it('returns a number', () => {
    expect(typeof nowMs()).toBe('number')
  })

  it('returns a positive value', () => {
    const result = nowMs()
    expect(result).toBeGreaterThan(0)
  })
})

describe('roundMs', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMs(1.23456)).toBe(1.23)
  })

  it('rounds up when needed', () => {
    expect(roundMs(1.235)).toBe(1.24)
  })

  it('handles integers', () => {
    expect(roundMs(5)).toBe(5)
  })

  it('handles zero', () => {
    expect(roundMs(0)).toBe(0)
  })

  it('handles negative values', () => {
    expect(roundMs(-1.234)).toBe(-1.23)
  })
})

describe('createSendDiagnostics', () => {
  it('creates text pipeline diagnostics', () => {
    const result = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'chatgpt',
      autoSend: true
    })

    expect(result.pipeline).toBe('text')
    expect(result.currentAI).toBe('chatgpt')
    expect(result.autoSend).toBe(true)
    expect(result.tabId).toBeUndefined()
    expect(result.timings).toEqual({
      queueWaitMs: 0,
      configResolveMs: 0,
      totalMs: 0
    })
  })

  it('creates image pipeline diagnostics', () => {
    const result = createSendDiagnostics({
      pipeline: 'image',
      currentAI: 'gemini',
      activeTabId: 'tab-123',
      autoSend: false
    })

    expect(result.pipeline).toBe('image')
    expect(result.currentAI).toBe('gemini')
    expect(result.tabId).toBe('tab-123')
    expect(result.autoSend).toBe(false)
  })
})

describe('attachDiagnostics', () => {
  it('attaches diagnostics to a success result', () => {
    const result = { success: true as const, mode: 'click' }
    const diagnostics = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'chatgpt',
      autoSend: true
    })

    const enriched = attachDiagnostics(result, diagnostics, performance.now())
    expect(enriched.success).toBe(true)
    expect(enriched.diagnostics).toBeDefined()
    expect(enriched.diagnostics!.currentAI).toBe('chatgpt')
  })

  it('attaches diagnostics to an error result', () => {
    const result = { success: false as const, error: 'webview_destroyed' }
    const diagnostics = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'chatgpt',
      autoSend: false
    })

    const enriched = attachDiagnostics(result, diagnostics, performance.now())
    expect(enriched.success).toBe(false)
    expect(enriched.error).toBe('webview_destroyed')
    expect(enriched.diagnostics).toBeDefined()
  })

  it('calculates totalMs from requestStartedAt', () => {
    const result = { success: true as const }
    const diagnostics = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'chatgpt',
      autoSend: true
    })

    const startedAt = performance.now()
    const enriched = attachDiagnostics(result, diagnostics, startedAt)
    expect(enriched.diagnostics!.timings.totalMs).toBeGreaterThanOrEqual(0)
  })

  it('does not mutate original result', () => {
    const result = { success: true as const, mode: 'click' }
    const diagnostics = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'chatgpt',
      autoSend: true
    })

    attachDiagnostics(result, diagnostics, performance.now())
    expect((result as any).diagnostics).toBeUndefined()
  })
})
