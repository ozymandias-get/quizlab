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

  it('removes every listener even when the first removal throws', () => {
    // A destroyed <webview> throws "Object has been destroyed". A single
    // try/catch around the whole cleanup block used to let the first throw skip
    // the other seven removeEventListener calls, which left the remaining
    // handlers registered.
    const throwing = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn((event: string) => {
        if (event === 'did-start-loading') throw new Error('Object has been destroyed')
      })
    }

    const { unmount } = renderHook(() =>
      useWebviewEvents({
        webviewElement: throwing as unknown as WebviewElement,
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

    expect(() => unmount()).not.toThrow()

    const removedEvents = throwing.removeEventListener.mock.calls.map((call) => call[0])
    expect(removedEvents).toEqual(
      expect.arrayContaining([
        'did-stop-loading',
        'did-fail-load',
        'new-window',
        'dom-ready',
        'render-process-gone',
        'did-navigate',
        'did-navigate-in-page'
      ])
    )
    expect(removedEvents).toHaveLength(8)
  })

  it('does not grow the listener count across 50 remounts', () => {
    // ChatGPT open -> tab away -> back -> model switch -> crash recovery,
    // repeated. Listener bookkeeping must return to the baseline, not creep.
    const live = new Map<string, Set<unknown>>()
    const element = {
      addEventListener: vi.fn((event: string, handler: unknown) => {
        const set = live.get(event) ?? new Set()
        set.add(handler)
        live.set(event, set)
      }),
      removeEventListener: vi.fn((event: string, handler: unknown) => {
        live.get(event)?.delete(handler)
      })
    }

    const render = () =>
      renderHook(() =>
        useWebviewEvents({
          webviewElement: element as unknown as WebviewElement,
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

    const baseline = 8
    for (let i = 0; i < 50; i++) {
      render().unmount()
    }

    const total = [...live.values()].reduce((sum, set) => sum + set.size, 0)
    expect(total).toBe(0)
    expect(element.addEventListener.mock.calls.length).toBe(baseline * 50)
  })
})
