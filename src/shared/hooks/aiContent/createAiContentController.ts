import type { AiContentController } from '@shared-core/types/aiContent'
import type {
  AiContentInputEvent,
  AiViewEvent,
  AiViewEventKind,
  AiViewEventOf,
  AiViewSource,
  AiViewStateSnapshot
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
  /**
   * Retires the managed view: it is destroyed in main and this handle's mirror
   * of it goes back to "no view" (not ready, not loading, generation dropped).
   */
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
  /**
   * Bumped by every lifecycle mutation, and stamped into the async operation
   * that mutation started.
   *
   * Attach is a round trip, so it can still be in flight when the tab is closed,
   * slept or evicted: `destroy()` clears the local mirror and answers, then the
   * pending attach resolves and would write a generation and flip `ready` back
   * to true — reporting a `WebContents` that main has already closed as usable,
   * which is how the send pipeline ends up injecting into a dead view. Every
   * completion therefore checks its own stamp and drops itself if a newer
   * lifecycle operation has since started.
   */
  let lifecycleEpoch = 0
  /**
   * True from an explicit `destroy()` until the next `attach()`.
   *
   * While retired the view this handle mirrors is gone, so incoming events are
   * dropped rather than buffered: the only thing buffered events can do at that
   * point is fill the buffer, and replaying one against a later attach would be
   * filtered by generation anyway.
   */
  let retired = false
  let currentUrl: string | undefined
  let loading = true
  /**
   * Mirrors `AiContentController.isReady`: true once main confirmed the view
   * exists, false before that and again after it was destroyed. `isDestroyed()`
   * is its inverse — the pair is what lets the send and picker pipelines refuse a
   * view that no longer exists without a round trip.
   */
  let ready = false
  const buffered: AiViewEvent[] = []

  const eventListeners = new Map<AiViewEventKind, Set<(event: never) => void>>()
  const readyListeners = new Set<(ready: boolean) => void>()

  function setReady(next: boolean): void {
    if (ready === next) return
    ready = next
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
    if (event.kind === 'state') applySnapshot(event)

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

  /**
   * Adopts the manager's authoritative description of the view.
   *
   * Only the two fields the synchronous accessors answer with are mirrored here;
   * whether the guest has settled and whether it failed are the host's business
   * and reach it through the `state` event.
   */
  function applySnapshot(snapshot: AiViewStateSnapshot): void {
    if (snapshot.currentUrl) currentUrl = snapshot.currentUrl
    loading = snapshot.isLoading
  }

  const unsubscribeEvents = subscribeAiViewEvents((event) => {
    if (event.viewId !== viewId) return
    if (generation === null) {
      if (retired) return
      if (buffered.length < MAX_BUFFERED_EVENTS) buffered.push(event)
      return
    }
    if (event.generation !== generation) return
    dispatch(event)
  })

  async function attach(restoredUrl?: string): Promise<boolean> {
    if (!client) return false
    const epoch = ++lifecycleEpoch
    // Cleared up front: main may report the guest's first navigation before this
    // invoke resolves, and those events are buffered rather than dropped.
    retired = false
    try {
      const response = await client.attach({
        viewId,
        source,
        ...((restoredUrl ?? init.restoredUrl)
          ? { restoredUrl: restoredUrl ?? init.restoredUrl }
          : {})
      })
      // A newer attach or a destroy started while this round trip was in the
      // air. Its answer describes a view this handle no longer mirrors.
      if (epoch !== lifecycleEpoch) return false

      generation = response.generation
      applySnapshot(response)
      setReady(true)

      // The snapshot is replayed locally as a `state` event rather than applied
      // to the host's React state from here: a host that mounted onto an
      // *existing* view never receives a `did-stop-loading`, so without this it
      // would wait for one forever and keep the native view hidden behind its
      // splash. Going through the same event type the manager pushes keeps a
      // single bootstrap path, and the buffered events are replayed after it so
      // a load that settled during the round trip wins over the older snapshot.
      dispatch({
        viewId,
        kind: 'state',
        generation: response.generation,
        currentUrl: response.currentUrl,
        isLoading: response.isLoading,
        hasLoadedOnce: response.hasLoadedOnce,
        error: response.error
      })
      const pending = buffered.splice(0, buffered.length)
      for (const event of pending) {
        if (event.generation === generation) dispatch(event)
      }
      return true
    } catch (error) {
      reportSuppressedError('aiContent.attach', { cause: error })
      // A rejection that lands after a destroy must not report the controller as
      // merely "not ready": the destroy already moved it to retired.
      if (epoch !== lifecycleEpoch) return false
      setReady(false)
      return false
    }
  }

  async function destroy(): Promise<boolean> {
    // Invalidate every operation started before this point, before anything
    // else: an in-flight attach that resolves later must not resurrect the
    // mirror this call is about to clear.
    lifecycleEpoch += 1
    // The local mirror is invalidated *before* the IPC round trip so a late
    // event from the dying view cannot write state in between, and so readiness
    // subscribers are released even if main never answers.
    generation = null
    retired = true
    buffered.length = 0
    loading = false
    setReady(false)
    // `currentUrl` is deliberately kept: it is the only record of where the
    // conversation was, and both `recreate()` and a later `attach()` replay it.
    if (!client) return false
    return client.destroy({ viewId }).catch((error: unknown) => {
      reportSuppressedError('aiContent.destroy', { cause: error })
      return false
    })
  }

  async function recreate(restoredUrl?: string): Promise<boolean> {
    const resumeUrl = restoredUrl ?? currentUrl
    const destroying = destroy()
    const epoch = lifecycleEpoch
    await destroying
    // Retirement or another recovery can supersede the destroy round trip.
    if (epoch !== lifecycleEpoch) return false
    return attach(resumeUrl)
  }

  const controller: AiContentControllerHandle = {
    viewId,

    attach,
    recreate,

    releaseHost: (hostToken) =>
      client ? client.detach({ viewId, hostToken }).catch(() => false) : Promise.resolve(false),

    destroy,

    executeJavaScript: (script) => {
      if (!client || !ready) return Promise.resolve(undefined)
      return client.executeScript({ viewId, script })
    },

    loadURL: (url) => {
      if (!client || !ready) return Promise.resolve(undefined)
      return client.loadUrl({ viewId, url }).then(() => undefined)
    },

    insertText: (text) => {
      if (!client || !ready) return Promise.resolve(false)
      return client.insertText({ viewId, text })
    },

    reload: () => {
      if (!client || !ready) return Promise.resolve(false)
      return client.reload({ viewId })
    },

    goBack: () => {
      if (!client || !ready) return Promise.resolve(false)
      return client.navigate({ viewId, delta: -1 })
    },

    goForward: () => {
      if (!client || !ready) return Promise.resolve(false)
      return client.navigate({ viewId, delta: 1 })
    },

    getURL: () => currentUrl,

    sendInputEvent: (inputEvent: AiContentInputEvent) => {
      if (!client || !ready) return Promise.resolve(false)
      return client.sendInputEvent({ viewId, inputEvent })
    },

    paste: () => {
      if (!client || !ready) return Promise.resolve(false)
      return client.paste({ viewId })
    },

    focus: () => {
      if (!client || !ready) return Promise.resolve(false)
      return client.focus({ viewId })
    },

    isDestroyed: () => !ready,
    isLoading: () => loading,
    isReady: () => ready,

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
        listener(ready)
      } catch (error) {
        reportSuppressedError('aiContent.subscribeReady', { cause: error })
      }
      return () => {
        readyListeners.delete(listener)
      }
    },

    dispose: () => {
      lifecycleEpoch += 1
      buffered.length = 0
      unsubscribeEvents()
      eventListeners.clear()
      readyListeners.clear()
    }
  }

  return controller
}
