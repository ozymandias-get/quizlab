import { describe, expect, it } from 'vitest'
import { attachDiagnostics, createSendDiagnostics } from '@features/ai/lib/send/sendDiagnostics'

describe('sendDiagnostics', () => {
  it('creates baseline diagnostics payload', () => {
    const diagnostics = createSendDiagnostics({
      pipeline: 'text',
      currentAI: 'gpt-4',
      activeTabId: 'tab-1',
      autoSend: true
    })

    expect(diagnostics).toEqual({
      pipeline: 'text',
      tabId: 'tab-1',
      currentAI: 'gpt-4',
      autoSend: true,
      timings: {
        queueWaitMs: 0,
        configResolveMs: 0,
        totalMs: 0
      }
    })
  })

  it('attaches diagnostics and computes totalMs', () => {
    const diagnostics = createSendDiagnostics({
      pipeline: 'image',
      currentAI: 'gemini',
      activeTabId: 'tab-2',
      autoSend: false
    })

    const result = attachDiagnostics({ success: true }, diagnostics, 0)
    expect(result.success).toBe(true)
    expect((result as any).diagnostics?.pipeline).toBe('image')
    expect(typeof (result as any).diagnostics?.timings.totalMs).toBe('number')
    expect(((result as any).diagnostics?.timings.totalMs ?? 0) >= 0).toBe(true)
  })
})
