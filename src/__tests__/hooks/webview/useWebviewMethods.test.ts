import type { WebviewElement } from '@shared-core/types/webview'

import { useWebviewMethods } from '@shared/hooks/webview/useWebviewMethods'

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn(() => ({
    forcePaste: vi.fn().mockResolvedValue(true)
  }))
}))

function createWebviewMock(overrides: Partial<WebviewElement> = {}): WebviewElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    executeJavaScript: vi.fn().mockResolvedValue({ success: true }),
    insertText: vi.fn(),
    reload: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    getURL: vi.fn().mockReturnValue('https://example.com'),
    sendInputEvent: vi.fn(),
    paste: vi.fn(),
    getWebContentsId: vi.fn().mockReturnValue(123),
    focus: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    ...overrides
  } as unknown as WebviewElement
}

describe('useWebviewMethods', () => {
  let activeWebviewRef: { current: WebviewElement | null }
  let webviewElementListenersRef: { current: Set<(el: WebviewElement | null) => void> }

  beforeEach(() => {
    activeWebviewRef = { current: null }
    webviewElementListenersRef = { current: new Set() }
    vi.clearAllMocks()
  })

  it('returns undefined when webview is null', () => {
    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    expect(result.current?.executeJavaScript?.('test')).toBeUndefined()
    expect(result.current?.getURL?.()).toBeUndefined()
    expect(result.current?.isDestroyed?.()).toBe(false)
  })

  it('returns undefined when webview is destroyed', () => {
    activeWebviewRef.current = createWebviewMock({ isDestroyed: () => true })

    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    expect(result.current?.executeJavaScript?.('test')).toBeUndefined()
    expect(result.current?.getURL?.()).toBeUndefined()
  })

  it('executeJavaScript calls webview method with Reflect.apply', () => {
    const wv = createWebviewMock()
    activeWebviewRef.current = wv

    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    result.current?.executeJavaScript?.('return 1+1;')

    expect(wv.executeJavaScript).toHaveBeenCalledWith('return 1+1;')
  })

  it('getWebview returns the active webview', () => {
    const wv = createWebviewMock()
    activeWebviewRef.current = wv

    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    expect(result.current?.getWebview?.()).toBe(wv)
  })

  it('getURL returns the webview URL', () => {
    const wv = createWebviewMock()
    activeWebviewRef.current = wv

    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    expect(result.current?.getURL?.()).toBe('https://example.com')
  })

  it('reload calls webview.reload', () => {
    const wv = createWebviewMock()
    activeWebviewRef.current = wv

    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    result.current?.reload?.()
    expect(wv.reload).toHaveBeenCalled()
  })

  it('focus calls webview.focus', () => {
    const wv = createWebviewMock()
    activeWebviewRef.current = wv

    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    result.current?.focus?.()
    expect(wv.focus).toHaveBeenCalled()
  })

  it('isDestroyed returns false when webview is not destroyed', () => {
    const wv = createWebviewMock()
    activeWebviewRef.current = wv

    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    expect(result.current?.isDestroyed?.()).toBe(false)
  })

  it('subscribeWebviewElement adds listener and calls it immediately', () => {
    const wv = createWebviewMock()
    activeWebviewRef.current = wv
    const listener = vi.fn()

    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    const unsubscribe = result.current?.subscribeWebviewElement?.(listener)

    expect(listener).toHaveBeenCalledWith(wv)
    expect(webviewElementListenersRef.current.has(listener)).toBe(true)

    unsubscribe?.()
    expect(webviewElementListenersRef.current.has(listener)).toBe(false)
  })

  it('pasteNative calls electronApi.forcePaste with id', async () => {
    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    const res = await result.current?.pasteNative?.(42)
    expect(res).toBe(true)
  })

  it('pasteNative returns false when id is 0', async () => {
    const { result } = renderHook(() =>
      useWebviewMethods({ activeWebviewRef, webviewElementListenersRef })
    )

    const res = await result.current?.pasteNative?.(0)
    expect(res).toBe(false)
  })
})
