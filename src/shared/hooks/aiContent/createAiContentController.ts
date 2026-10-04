import type { AiContentController } from '@shared-core/types/aiContent'
import type {
  AiContentInputEvent,
  AiViewEvent,
  AiViewEventKind,
  AiViewEventOf,
  AiViewSource
} from '@shared-core/types/aiView'

import { reportSuppressedError } from '@shared/lib/logger'

import { getAiViewClient, subscribeAiViewEvents } from './aiViewClient'

/**
 * Renderer-side handle for one main-process-owned `WebContentsView`.
 *
 * The controller keeps a local mirror of the view's URL, loading flag and
 * readiness so the synchronous accessors the send pipeline relies on
 * (`getURL()`, `isDestroyed()`) keep working without a round trip. Every
 * mutation goes through typed IPC keyed by `viewId`, so the renderer can only
 * ever address a view the manager already owns.
 */

const MAX_BUFFERED_EVENTS = 64

export interface AiContentControllerInit {
  viewId: string
  source: AiViewSource
  /** URL to replay after a cold unmount; validated in the main process. */
  restoredUrl?: string
}

export interface AiContentControllerHandle extends AiContentController {
  viewId: string
  /** Creates the view if needed and starts mirroring its state. */
  attach: (restoredUrl?: string) => Promise<boolean>
  /** Tears the view down in main and creates a replacement (crash recovery). */
  recreate: (restoredUrl?: string) => Promise<boolean>
  /** Releases this host's claim without destroying the view. */
  releaseHost: (hostToken: string) => Promise<boolean>
  destroy: () => Promise<boolean>
  /** Detaches the shared event subscription; does not touch the managed view. */
  dispose: () => void
}

export function createAiContentController(
  init: AiContentControllerInit
): AiContentControllerHandle {
  const { viewId, source } = init
  const client = getAiViewClient()

  let generation: number | null = null
  let currentUrl: string | undefined
  let loading = true
  let destroyed = true
  const buffered: AiViewEvent[] = []

  const eventListeners = new Map<AiViewEventKind, Set<(event: never) => void>>()
  const readyListeners = new Set<(ready: boolean) => void>()

  function setReady(next: boolean): void {
    if (destroyed === !next) return
    destroyed = !next
    for (const listener of readyListeners) {
      try {
        listener(next)
      } catch (error) {
        reportSuppressedError('aiContent.readyListener', { cause: error })
      }
    }
  }

  function dispatch(event: AiViewEvent): void {
    // Navigation events carry `url`, load events carry `currentUrl`; both have to
    // feed the mirror because the send pipeline reads `getURL()` synchronously.
    if ('currentUrl' in event && event.currentUrl) currentUrl = event.currentUrl
    else if ('url' in event && event.url) currentUrl = event.url
    if (event.kind === 'did-start-loading') loading = true
    if (event.kind === 'did-stop-loading' || event.kind === 'dom-ready') loading = false

    const listeners = eventListeners.get(event.kind)
    if (!listeners) return
    for (const listener of listeners) {
      try {
        ;(listener as (value: AiViewEvent) => void)(event)
      } catch (error) {
        reportSuppressedError('aiContent.eventListener', { cause: error })
      }
    }
  }

  const unsubscribeEvents = subscribeAiViewEvents((event) => {
    if (event.viewId !== viewId) return
    if (generation === null) {
      if (buffered.length < MAX_BUFFERED_EVENTS) buffered.push(event)
      return
    }
    if (event.generation !== generation) return
    dispatch(event)
  })

  async function attach(restoredUrl?: string): Promise<boolean> {
    if (!client) return false
    try {
      const response = await client.attach({
        viewId,
        source,
        ...((restoredUrl ?? init.restoredUrl)
          ? { restoredUrl: restoredUrl ?? init.restoredUrl }
          : {})
      })
      generation = response.generation
      currentUrl = response.currentUrl
      setReady(true)
      const pending = buffered.splice(0, buffered.length)
      for (const event of pending) {
        if (event.generation === generation) dispatch(event)
      }
      return true
    } catch (error) {
      reportSuppressedError('aiContent.attach', { cause: error })
      setReady(false)
      return false
    }
  }

  async function recreate(restoredUrl?: string): Promise<boolean> {
    if (client) {
      await client.destroy({ viewId }).catch(() => false)
    }
    buffered.length = 0
    generation = null
    setReady(false)
    return attach(restoredUrl ?? currentUrl)
  }

  const controller: AiContentControllerHandle = {
    viewId,

    attach,
    recreate,

    releaseHost: (hostToken) =>
      client ? client.detach({ viewId, hostToken }).catch(() => false) : Promise.resolve(false),

    destroy: () =>
      client ? client.destroy({ viewId }).catch(() => false) : Promise.resolve(false),

    executeJavaScript: (script) => {
      if (!client || destroyed) return Promise.resolve(undefined)
      return client.executeScript({ viewId, script })
    },

    loadURL: (url) => {
      if (!client || destroyed) return Promise.resolve(undefined)
      return client.loadUrl({ viewId, url }).then(() => undefined)
    },

    insertText: (text) => {
      if (!client || destroyed) return Promise.resolve(false)
      return client.insertText({ viewId, text })
    },

    reload: () => {
      if (!client || destroyed) return Promise.resolve(false)
      return client.reload({ viewId })
    },

    goBack: () => {
      if (!client || destroyed) return Promise.resolve(false)
      return client.navigate({ viewId, delta: -1 })
    },

    goForward: () => {
      if (!client || destroyed) return Promise.resolve(false)
      return client.navigate({ viewId, delta: 1 })
    },

    getURL: () => currentUrl,

    sendInputEvent: (inputEvent: AiContentInputEvent) => {
      if (!client || destroyed) return Promise.resolve(false)
      return client.sendInputEvent({ viewId, inputEvent })
    },

    paste: () => {
      if (!client || destroyed) return Promise.resolve(false)
      return client.paste({ viewId })
    },

    focus: () => {
      if (!client || destroyed) return Promise.resolve(false)
      return client.focus({ viewId })
    },

    isDestroyed: () => destroyed,
    isLoading: () => loading,
    isReady: () => !destroyed,

    subscribeEvent: <K extends AiViewEventKind>(
      kind: K,
      handler: (event: AiViewEventOf<K>) => void
    ) => {
      const existing = eventListeners.get(kind)
      if (existing) existing.add(handler as (event: never) => void)
      else eventListeners.set(kind, new Set([handler as (event: never) => void]))
      return () => {
        eventListeners.get(kind)?.delete(handler as (event: never) => void)
      }
    },

    subscribeReady: (listener) => {
      readyListeners.add(listener)
      try {
        listener(!destroyed)
      } catch (error) {
        reportSuppressedError('aiContent.subscribeReady', { cause: error })
      }
      return () => {
        readyListeners.delete(listener)
      }
    },

    dispose: () => {
      unsubscribeEvents()
      eventListeners.clear()
      readyListeners.clear()
    }
  }

  return controller
}
