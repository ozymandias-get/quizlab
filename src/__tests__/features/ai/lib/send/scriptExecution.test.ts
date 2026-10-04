import {
  cloneScriptDiagnostics,
  executeContentScript,
  isContentDestroyedError,
  normalizeExecutionResult
} from '@features/ai/lib/send/scriptExecution'

import type { AiContentController } from '@shared-core/types/aiContent'

import { describe, expect, it } from 'vitest'

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

  describe('isContentDestroyedError', () => {
    it('detects Electron destroyed-content messages', () => {
      expect(isContentDestroyedError(new Error('Error: WebContents was destroyed'))).toBe(true)
      expect(isContentDestroyedError('Object has been destroyed')).toBe(true)
      expect(isContentDestroyedError('Attempting to call a function in a destroyed renderer')).toBe(
        true
      )
      expect(isContentDestroyedError('content frame has been disposed')).toBe(true)
    })

    it('does not match unrelated errors', () => {
      expect(isContentDestroyedError(new Error('input_not_found'))).toBe(false)
      expect(isContentDestroyedError('timed out')).toBe(false)
      expect(isContentDestroyedError(null)).toBe(false)
      expect(isContentDestroyedError(undefined)).toBe(false)
      expect(isContentDestroyedError(42)).toBe(false)
    })
  })

  describe('executeContentScript', () => {
    const makeWebview = (executeJavaScript: () => Promise<unknown>): AiContentController =>
      ({
        executeJavaScript,
        isDestroyed: () => false
      }) as unknown as AiContentController

    it('resolves with the script value on success', async () => {
      const content = makeWebview(() => Promise.resolve({ success: true }))
      const result = await executeContentScript(content, 'return 1;')
      expect(result).toEqual({ ok: true, value: { success: true } })
    })

    it('converts destroyed-content rejection into a controlled destroyed result', async () => {
      const content = makeWebview(() =>
        Promise.reject(new Error('Error: WebContents was destroyed'))
      )
      const result = await executeContentScript(content, 'return 1;')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.destroyed).toBe(true)
      }
    })

    it('flags undefined results as destroyed when the content is gone', async () => {
      const content = {
        executeJavaScript: () => Promise.resolve(undefined),
        isDestroyed: () => true
      } as unknown as AiContentController
      const result = await executeContentScript(content, 'return 1;')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.destroyed).toBe(true)
      }
    })

    it('keeps undefined results when the content is alive', async () => {
      const content = makeWebview(() => Promise.resolve(undefined))
      const result = await executeContentScript(content, 'return 1;')
      expect(result).toEqual({ ok: true, value: undefined })
    })

    it('converts generic rejections into a non-destroyed failure', async () => {
      const content = makeWebview(() => Promise.reject(new Error('some random failure')))
      const result = await executeContentScript(content, 'return 1;')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.destroyed).toBe(false)
        expect((result.error as Error).message).toBe('some random failure')
      }
    })

    it('never throws, even if the implementation throws synchronously', async () => {
      const content = makeWebview(() => {
        throw new Error('sync boom')
      })
      const result = await executeContentScript(content, 'return 1;')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.destroyed).toBe(false)
      }
    })
  })
})
