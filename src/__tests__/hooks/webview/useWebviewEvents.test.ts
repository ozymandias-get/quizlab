import type { WebviewElement } from '@shared-core/types/webview'

import { useWebviewEvents } from '@shared/hooks/webview/useWebviewEvents'

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useWebviewEvents', () => {
  let webviewElement: Record<string, ReturnType<typeof vi.fn>>
  let onStartLoading: any
  let onStopLoading: any
  let onFailLoad: any
  let onNewWindow: any
  let onDomReady: any
  let onCrashed: any
  let onDidNavigate: any
  let onDidNavigateInPage: any

  beforeEach(() => {
    webviewElement = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    onStartLoading = vi.fn()
    onStopLoading = vi.fn()
    onFailLoad = vi.fn()
    onNewWindow = vi.fn()
    onDomReady = vi.fn()
    onCrashed = vi.fn()
    onDidNavigate = vi.fn()
    onDidNavigateInPage = vi.fn()
  })

  it('should register event listeners when mounted', () => {
    const { unmount } = renderHook(() =>
      useWebviewEvents({
        webviewElement: webviewElement as unknown as WebviewElement,
        onStartLoading,
        onStopLoading,
        onFailLoad,
        onNewWindow,
        onDomReady,
        onCrashed,
        onDidNavigate,
        onDidNavigateInPage
      })
    )

    expect(webviewElement.addEventListener).toHaveBeenCalledWith(
      'did-start-loading',
      onStartLoading
    )
    expect(webviewElement.addEventListener).toHaveBeenCalledWith('did-stop-loading', onStopLoading)
    expect(webviewElement.addEventListener).toHaveBeenCalledWith('did-fail-load', onFailLoad)
    expect(webviewElement.addEventListener).toHaveBeenCalledWith('new-window', onNewWindow)
    expect(webviewElement.addEventListener).toHaveBeenCalledWith('dom-ready', onDomReady)
    expect(webviewElement.addEventListener).toHaveBeenCalledWith('render-process-gone', onCrashed)
    expect(webviewElement.addEventListener).toHaveBeenCalledWith('did-navigate', onDidNavigate)
    expect(webviewElement.addEventListener).toHaveBeenCalledWith(
      'did-navigate-in-page',
      onDidNavigateInPage
    )

    unmount()

    expect(webviewElement.removeEventListener).toHaveBeenCalledWith(
      'did-start-loading',
      onStartLoading
    )
    expect(webviewElement.removeEventListener).toHaveBeenCalledWith(
      'did-stop-loading',
      onStopLoading
    )
    expect(webviewElement.removeEventListener).toHaveBeenCalledWith('did-fail-load', onFailLoad)
    expect(webviewElement.removeEventListener).toHaveBeenCalledWith('new-window', onNewWindow)
    expect(webviewElement.removeEventListener).toHaveBeenCalledWith('dom-ready', onDomReady)
    expect(webviewElement.removeEventListener).toHaveBeenCalledWith(
      'render-process-gone',
      onCrashed
    )
    expect(webviewElement.removeEventListener).toHaveBeenCalledWith('did-navigate', onDidNavigate)
    expect(webviewElement.removeEventListener).toHaveBeenCalledWith(
      'did-navigate-in-page',
      onDidNavigateInPage
    )
  })

  it('should not throw if webviewElement is null', () => {
    expect(() => {
      renderHook(() =>
        useWebviewEvents({
          webviewElement: null,
          onStartLoading,
          onStopLoading,
          onFailLoad,
          onNewWindow,
          onDomReady,
          onCrashed,
          onDidNavigate,
          onDidNavigateInPage
        })
      )
    }).not.toThrow()
  })

  it('should not register optional did-navigate if onDidNavigate is undefined', () => {
    renderHook(() =>
      useWebviewEvents({
        webviewElement: webviewElement as unknown as WebviewElement,
        onStartLoading,
        onStopLoading,
        onFailLoad,
        onNewWindow,
        onDomReady,
        onCrashed,
        onDidNavigateInPage
      })
    )

    expect(webviewElement.addEventListener).not.toHaveBeenCalledWith(
      'did-navigate',
      expect.any(Function)
    )
  })

  it('should clean up listeners on old webview and register on new webview if element changes', () => {
    const webviewElement1 = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    const webviewElement2 = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }

    let currentWv = webviewElement1

    const { rerender } = renderHook(() =>
      useWebviewEvents({
        webviewElement: currentWv as unknown as WebviewElement,
        onStartLoading,
        onStopLoading,
        onFailLoad,
        onNewWindow,
        onDomReady,
        onCrashed,
        onDidNavigate,
        onDidNavigateInPage
      })
    )

    expect(webviewElement1.addEventListener).toHaveBeenCalled()
    expect(webviewElement2.addEventListener).not.toHaveBeenCalled()

    currentWv = webviewElement2
    rerender()

    expect(webviewElement1.removeEventListener).toHaveBeenCalled()
    expect(webviewElement2.addEventListener).toHaveBeenCalled()
  })
})
