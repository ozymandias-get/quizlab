import type { AiContentController } from '@shared-core/types/aiContent'

import {
  oncePickerReady,
  waitForContentReady
} from '@app/providers/app-tool/aiContentPickerReadiness'

import { describe, expect, it, vi } from 'vitest'

function createController(
  overrides: Partial<AiContentController> & { initiallyReady?: boolean } = {}
): AiContentController & {
  _trigger: (kind: 'dom-ready' | 'did-stop-loading') => void
  _setReady: (ready: boolean) => void
} {
  const { initiallyReady = true, ...rest } = overrides
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  const readyListeners = new Set<(ready: boolean) => void>()
  let ready = initiallyReady

  const controller = {
    executeJavaScript: vi.fn().mockResolvedValue('loading'),
    isReady: () => ready,
    isDestroyed: () => !ready,
    subscribeEvent: (<K extends 'dom-ready' | 'did-stop-loading'>(
      kind: K,
      handler: (event: unknown) => void
    ) => {
      const set = listeners.get(kind) ?? new Set()
      set.add(handler)
      listeners.set(kind, set)
      return () => {
        set.delete(handler)
      }
    }) as AiContentController['subscribeEvent'],
    subscribeReady: (listener: (isReady: boolean) => void) => {
      readyListeners.add(listener)
      listener(ready)
      return () => {
        readyListeners.delete(listener)
      }
    },
    _trigger: (kind: 'dom-ready' | 'did-stop-loading') => {
      listeners.get(kind)?.forEach((handler) => handler({ kind }))
    },
    _setReady: (next: boolean) => {
      ready = next
      readyListeners.forEach((listener) => listener(next))
    }
  }

  return { ...controller, ...rest } as AiContentController & {
    _trigger: (kind: 'dom-ready' | 'did-stop-loading') => void
    _setReady: (ready: boolean) => void
  }
}

describe('waitForContentReady', () => {
  it('resolves immediately when the managed view is already confirmed', async () => {
    const controller = createController()
    await expect(
      waitForContentReady(controller, new AbortController().signal)
    ).resolves.toBeUndefined()
  })

  it('waits until main confirms the view exists', async () => {
    const controller = createController({ initiallyReady: false })
    const signal = new AbortController().signal
    let settled = false
    void waitForContentReady(controller, signal).then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    controller._setReady(true)
    await vi.waitFor(() => {
      expect(settled).toBe(true)
    })
  })

  it('rejects when the caller aborts while waiting', async () => {
    const controller = createController({ initiallyReady: false })
    const abort = new AbortController()
    const pending = waitForContentReady(controller, abort.signal)
    abort.abort()
    await expect(pending).rejects.toThrow(/abort/i)
  })

  it('rejects immediately for an already-aborted signal', async () => {
    const controller = createController({ initiallyReady: false })
    const abort = new AbortController()
    abort.abort()
    await expect(waitForContentReady(controller, abort.signal)).rejects.toThrow(/abort/i)
  })

  it('fails closed when the controller cannot report readiness', async () => {
    const controller = { executeJavaScript: vi.fn() } as unknown as AiContentController
    await expect(waitForContentReady(controller, new AbortController().signal)).rejects.toThrow(
      /subscribeReady/
    )
  })
})

describe('oncePickerReady', () => {
  it('fulfills on dom-ready', async () => {
    const controller = createController({ executeJavaScript: vi.fn().mockResolvedValue('loading') })
    const pending = oncePickerReady(controller, new AbortController().signal)
    controller._trigger('dom-ready')
    await expect(pending).resolves.toBe('dom-ready')
  })

  it('fulfills on did-stop-loading', async () => {
    const controller = createController({ executeJavaScript: vi.fn().mockResolvedValue('loading') })
    const pending = oncePickerReady(controller, new AbortController().signal)
    controller._trigger('did-stop-loading')
    await expect(pending).resolves.toBe('did-stop-loading')
  })

  it('falls back to a document.readyState catch-up when events already fired', async () => {
    const controller = createController({
      executeJavaScript: vi.fn().mockResolvedValue('complete')
    })
    await expect(oncePickerReady(controller, new AbortController().signal)).resolves.toBe(
      'catchup-ready-state'
    )
  })

  it('only fires once even if several readiness signals arrive', async () => {
    const controller = createController({ executeJavaScript: vi.fn().mockResolvedValue('loading') })
    const pending = oncePickerReady(controller, new AbortController().signal)
    controller._trigger('dom-ready')
    controller._trigger('did-stop-loading')
    await expect(pending).resolves.toBe('dom-ready')
  })

  it('rejects when aborted before readiness', async () => {
    const controller = createController({ executeJavaScript: vi.fn().mockResolvedValue('loading') })
    const abort = new AbortController()
    const pending = oncePickerReady(controller, abort.signal)
    abort.abort()
    await expect(pending).rejects.toThrow(/abort/i)
  })
})
