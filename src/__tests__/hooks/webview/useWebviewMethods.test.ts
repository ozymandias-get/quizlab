import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWebviewMethods } from '@shared/hooks/webview/useWebviewMethods'
import type { RefObject } from 'react'
import type { WebviewElement } from '@shared-core/types/webview'

describe('useWebviewMethods Hook', () => {
  let activeWebview: Record<string, any>
  let activeWebviewRef: RefObject<WebviewElement | null>
  let webviewElementListenersRef: RefObject<Set<(el: WebviewElement | null) => void>>

  beforeEach(() => {
    vi.restoreAllMocks()
    activeWebview = {
      isDestroyed: vi.fn().mockReturnValue(false),
      executeJavaScript: vi.fn().mockImplementation(() => Promise.resolve('js-result')),
      insertText: vi.fn(),
      reload: vi.fn(),
      goBack: vi.fn(),
      goForward: vi.fn(),
      getURL: vi.fn().mockReturnValue('https://example.com'),
      sendInputEvent: vi.fn(),
      paste: vi.fn(),
      getWebContentsId: vi.fn().mockReturnValue(42),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      focus: vi.fn()
    }
    activeWebviewRef = { current: activeWebview as unknown as WebviewElement }
    webviewElementListenersRef = { current: new Set() }

    // Mock Electron API
    Object.defineProperty(window, 'electronAPI', {
      value: {
        forcePaste: vi.fn().mockResolvedValue(true)
      },
      writable: true,
      configurable: true
    })
  })

  it('should return undefined or false when there is no active webview', () => {
    activeWebviewRef.current = null
    const { result } = renderHook(
      () =>
        useWebviewMethods({
          activeWebviewRef,
          webviewElementListenersRef
        }) as any
    )

    expect(result.current.getWebview()).toBeNull()
    expect(result.current.reload()).toBeUndefined()
    expect(result.current.insertText('hello')).toBeUndefined()
    expect(result.current.executeJavaScript('alert()')).toBeUndefined()
    expect(result.current.isDestroyed()).toBe(false)
  })

  it('should return false for isDestroyed when activeWebview is missing or when it is destroyed', () => {
    const { result } = renderHook(
      () =>
        useWebviewMethods({
          activeWebviewRef,
          webviewElementListenersRef
        }) as any
    )

    expect(result.current.isDestroyed()).toBe(false)

    activeWebview.isDestroyed.mockReturnValue(true)
    expect(result.current.isDestroyed()).toBe(false)
  })

  it('should safely delegate operations to active webview using Reflect.apply', async () => {
    const { result } = renderHook(
      () =>
        useWebviewMethods({
          activeWebviewRef,
          webviewElementListenersRef
        }) as any
    )

    result.current.reload()
    expect(activeWebview.reload).toHaveBeenCalled()

    result.current.insertText('test text')
    expect(activeWebview.insertText).toHaveBeenCalledWith('test text')

    result.current.goBack()
    expect(activeWebview.goBack).toHaveBeenCalled()

    result.current.goForward()
    expect(activeWebview.goForward).toHaveBeenCalled()

    expect(result.current.getURL()).toBe('https://example.com')

    const dummyEvent = { type: 'keyDown' } as any
    result.current.sendInputEvent(dummyEvent)
    expect(activeWebview.sendInputEvent).toHaveBeenCalledWith(dummyEvent)

    result.current.paste()
    expect(activeWebview.paste).toHaveBeenCalled()

    expect(result.current.getWebContentsId()).toBe(42)

    result.current.focus()
    expect(activeWebview.focus).toHaveBeenCalled()

    const handler = () => {}
    result.current.addEventListener('click', handler)
    expect(activeWebview.addEventListener).toHaveBeenCalledWith('click', handler, undefined)

    result.current.removeEventListener('click', handler)
    expect(activeWebview.removeEventListener).toHaveBeenCalledWith('click', handler, undefined)

    const jsRes = await result.current.executeJavaScript('console.log()')
    expect(jsRes).toBe('js-result')
    expect(activeWebview.executeJavaScript).toHaveBeenCalledWith('console.log()')
  })

  it('should call electron forcePaste in pasteNative method', async () => {
    const { result } = renderHook(
      () =>
        useWebviewMethods({
          activeWebviewRef,
          webviewElementListenersRef
        }) as any
    )

    const nativePasteRes = await result.current.pasteNative(123)
    expect(nativePasteRes).toBe(true)
    expect(window.electronAPI.forcePaste).toHaveBeenCalledWith(123)
  })

  it('should return false for pasteNative if id is falsy', async () => {
    const { result } = renderHook(
      () =>
        useWebviewMethods({
          activeWebviewRef,
          webviewElementListenersRef
        }) as any
    )

    const nativePasteRes = await result.current.pasteNative(0)
    expect(nativePasteRes).toBe(false)
    expect(window.electronAPI.forcePaste).not.toHaveBeenCalled()
  })

  it('should support subscribeWebviewElement subscription and unsubscription lifecycle', () => {
    const { result } = renderHook(
      () =>
        useWebviewMethods({
          activeWebviewRef,
          webviewElementListenersRef
        }) as any
    )

    const listener = vi.fn()
    const unsubscribe = result.current.subscribeWebviewElement(listener)

    expect(webviewElementListenersRef.current?.has(listener)).toBe(true)
    expect(listener).toHaveBeenCalledWith(activeWebview)

    unsubscribe()
    expect(webviewElementListenersRef.current?.has(listener)).toBe(false)
  })
})
