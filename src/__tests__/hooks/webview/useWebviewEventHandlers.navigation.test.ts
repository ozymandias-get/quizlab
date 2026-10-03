import type { WebviewElement } from '@shared-core/types/webview'

import { useWebviewEventHandlers } from '@shared/hooks/webview/useWebviewEventHandlers'

import { renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createWebview = () =>
  ({
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    insertCSS: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn(() => 'https://example.test/'),
    send: vi.fn()
  }) as unknown as WebviewElement & { executeJavaScript: ReturnType<typeof vi.fn> }

const setup = () => {
  const webview = createWebview()
  const activeWebviewRef = { current: webview } as RefObject<WebviewElement | null>
  const onUrlChangeRef = { current: undefined } as RefObject<((url: string) => void) | undefined>
  const onPageSettledRef = { current: undefined } as RefObject<
    ((wv: WebviewElement) => void) | undefined
  >

  const handlers = renderHook(() =>
    useWebviewEventHandlers({
      activeWebviewRef,
      hasInitiallyLoadedRef: { current: false },
      onUrlChangeRef,
      onPageSettledRef,
      setIsLoading: vi.fn(),
      setError: vi.fn(),
      showWarning: vi.fn(),
      t: (key: string) => key
    })
  ).result.current

  return { webview, handlers }
}

const navigateEvent = (url: string) => ({ url }) as unknown as Event

describe('useWebviewEventHandlers navigation teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aborts pending automation on an in-page navigation', () => {
    const { webview, handlers } = setup()
    handlers.handleDidNavigateInPage(navigateEvent('https://example.test/c/2'))

    const script = webview.executeJavaScript.mock.calls[0][0] as string
    expect(script).toContain('__quizlabAbortController')
  })

  it('tears the element picker down on an in-page navigation', () => {
    // The picker's iframeObserver watches documentElement with {subtree:true}
    // and runs a whole-document querySelectorAll('iframe') for every mutation
    // batch. An SPA route change keeps the JS realm, so without an explicit
    // cleanup the armed picker and its observers survived the navigation.
    const { webview, handlers } = setup()
    handlers.handleDidNavigateInPage(navigateEvent('https://example.test/c/2'))

    const script = webview.executeJavaScript.mock.calls[0][0] as string
    expect(script).toContain('_aiPickerCleanup')
  })

  it('tears the element picker down on a full navigation', () => {
    const { webview, handlers } = setup()
    handlers.handleDidNavigate(navigateEvent('https://example.test/c/3'))

    const script = webview.executeJavaScript.mock.calls[0][0] as string
    expect(script).toContain('__quizlabAbortController')
    expect(script).toContain('_aiPickerCleanup')
  })

  it('keeps each teardown independent so one failure cannot skip the other', () => {
    const { webview, handlers } = setup()
    handlers.handleDidNavigate(navigateEvent('https://example.test/c/4'))

    const script = webview.executeJavaScript.mock.calls[0][0] as string
    // Two separate try/catch blocks: abort() throwing must not prevent the
    // picker cleanup from running.
    expect(script.match(/try\{/g)).toHaveLength(2)
    expect(script).toMatch(
      /__quizlabAbortController.*?\}catch\(e\)\{\}try\{window\._aiPickerCleanup/
    )
  })

  it('does not throw when the guest context is already gone', () => {
    const { webview, handlers } = setup()
    webview.executeJavaScript.mockImplementation(() => {
      throw new Error('Render frame was disposed before WebFrameMain could be accessed')
    })

    expect(() => handlers.handleDidNavigate(navigateEvent('https://example.test/'))).not.toThrow()
  })

  it('reports the new URL to the onUrlChange callback', () => {
    const webview = createWebview()
    const onUrlChange = vi.fn()
    const handlers = renderHook(() =>
      useWebviewEventHandlers({
        activeWebviewRef: { current: webview } as RefObject<WebviewElement | null>,
        hasInitiallyLoadedRef: { current: false },
        onUrlChangeRef: { current: onUrlChange } as RefObject<((url: string) => void) | undefined>,
        onPageSettledRef: { current: undefined } as RefObject<
          ((wv: WebviewElement) => void) | undefined
        >,
        setIsLoading: vi.fn(),
        setError: vi.fn(),
        showWarning: vi.fn(),
        t: (key: string) => key
      })
    ).result.current

    handlers.handleDidNavigateInPage(navigateEvent('https://example.test/c/9'))

    expect(onUrlChange).toHaveBeenCalledWith('https://example.test/c/9')
  })
})
