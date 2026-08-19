import {
  cloneScriptDiagnostics,
  executeWebviewScript,
  isWebviewDestroyedError,
  normalizeExecutionResult
} from '@features/ai/lib/send/scriptExecution'

import type { WebviewController } from '@shared-core/types/webview'

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

  describe('isWebviewDestroyedError', () => {
    it('detects Electron destroyed-webview messages', () => {
      expect(isWebviewDestroyedError(new Error('Error: WebContents was destroyed'))).toBe(true)
      expect(isWebviewDestroyedError('Object has been destroyed')).toBe(true)
      expect(isWebviewDestroyedError('Attempting to call a function in a destroyed renderer')).toBe(
        true
      )
      expect(isWebviewDestroyedError('webview frame has been disposed')).toBe(true)
    })

    it('does not match unrelated errors', () => {
      expect(isWebviewDestroyedError(new Error('input_not_found'))).toBe(false)
      expect(isWebviewDestroyedError('timed out')).toBe(false)
      expect(isWebviewDestroyedError(null)).toBe(false)
      expect(isWebviewDestroyedError(undefined)).toBe(false)
      expect(isWebviewDestroyedError(42)).toBe(false)
    })
  })

  describe('executeWebviewScript', () => {
    const makeWebview = (executeJavaScript: () => Promise<unknown>): WebviewController =>
      ({
        executeJavaScript,
        isDestroyed: () => false
      }) as unknown as WebviewController

    it('resolves with the script value on success', async () => {
      const webview = makeWebview(() => Promise.resolve({ success: true }))
      const result = await executeWebviewScript(webview, 'return 1;')
      expect(result).toEqual({ ok: true, value: { success: true } })
    })

    it('converts destroyed-webview rejection into a controlled destroyed result', async () => {
      const webview = makeWebview(() =>
        Promise.reject(new Error('Error: WebContents was destroyed'))
      )
      const result = await executeWebviewScript(webview, 'return 1;')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.destroyed).toBe(true)
      }
    })

    it('flags undefined results as destroyed when the webview is gone', async () => {
      const webview = {
        executeJavaScript: () => Promise.resolve(undefined),
        isDestroyed: () => true
      } as unknown as WebviewController
      const result = await executeWebviewScript(webview, 'return 1;')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.destroyed).toBe(true)
      }
    })

    it('keeps undefined results when the webview is alive', async () => {
      const webview = makeWebview(() => Promise.resolve(undefined))
      const result = await executeWebviewScript(webview, 'return 1;')
      expect(result).toEqual({ ok: true, value: undefined })
    })

    it('converts generic rejections into a non-destroyed failure', async () => {
      const webview = makeWebview(() => Promise.reject(new Error('some random failure')))
      const result = await executeWebviewScript(webview, 'return 1;')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.destroyed).toBe(false)
        expect((result.error as Error).message).toBe('some random failure')
      }
    })

    it('never throws, even if the implementation throws synchronously', async () => {
      const webview = makeWebview(() => {
        throw new Error('sync boom')
      })
      const result = await executeWebviewScript(webview, 'return 1;')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.destroyed).toBe(false)
      }
    })
  })
})
