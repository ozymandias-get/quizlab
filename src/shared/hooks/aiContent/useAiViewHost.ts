import type { AiViewBounds } from '@shared-core/types/aiView'

import { useCallback, useEffect, useRef, useState } from 'react'

import { getAiViewClient } from './aiViewClient'

/**
 * Keeps a main-process `WebContentsView` aligned with a React host placeholder.
 *
 * A native view is not in the DOM, so its geometry has to be mirrored from
 * `getBoundingClientRect()`. Three rules keep this cheap and deterministic:
 *
 * 1. Exactly one host writes. `isHostOwner` is true only for the host that
 *    currently owns the view (active surface + active tab), so a placeholder
 *    that is still mounted behind a focus-mode animation never fights the one
 *    in front.
 * 2. Updates are coalesced into a single animation frame, so a resize drag
 *    cannot flood IPC.
 * 3. Identical rectangles are dropped, so React re-renders that do not move the
 *    host produce no traffic at all.
 */

export interface UseAiViewHostOptions {
  viewId: string
  /** Identity of this host. Only the current owner may move the view. */
  hostToken: string
  /** Whether this host is the single writer for the view. */
  isHostOwner: boolean
  /** Whether the native view should currently be on screen. */
  visible: boolean
}

export interface UseAiViewHostResult {
  setHostElement: (element: HTMLDivElement | null) => void
  /** Pushes the current rectangle immediately, bypassing frame coalescing. */
  flush: () => void
}

interface HostSnapshot {
  bounds: AiViewBounds
  visible: boolean
}

const requestFrame = (callback: () => void): number =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : window.setTimeout(callback, 16)

const cancelFrame = (handle: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  else window.clearTimeout(handle)
}

function toBounds(rect: DOMRect, borderRadius: number): AiViewBounds {
  return {
    x: Math.max(0, Math.round(rect.left)),
    y: Math.max(0, Math.round(rect.top)),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
    borderRadius
  }
}

/**
 * Finds the corner radius the panel clips its content to.
 *
 * The host placeholder is a plain flex child, so it has no radius of its own —
 * the rounding belongs to the panel that wraps it (`overflow: hidden` plus a
 * `border-radius`). A native view is composited above the DOM and cannot inherit
 * that, so the value has to be measured and shipped across.
 *
 * The panel's border width is subtracted because the host sits inside the border
 * box: a 16px radius around a 1px border leaves the content corner at 15px.
 * Reading it from the DOM also means a theme or density change is picked up for
 * free instead of being hard-coded here.
 */
function resolveClipRadius(element: HTMLElement): number {
  if (typeof window.getComputedStyle !== 'function') return 0
  let node: HTMLElement | null = element
  while (node instanceof HTMLElement && node !== document.body) {
    const style = window.getComputedStyle(node)
    const clips = style.overflowX === 'hidden' || style.overflowY === 'hidden'
    const radius = Number.parseFloat(style.borderTopLeftRadius)
    if (clips && Number.isFinite(radius) && radius > 0) {
      const border = Number.parseFloat(style.borderTopWidth)
      return Math.max(0, radius - (Number.isFinite(border) ? border : 0))
    }
    node = node.parentElement
  }
  return 0
}

function snapshotEqual(a: HostSnapshot | null, b: HostSnapshot): boolean {
  return (
    a !== null &&
    a.visible === b.visible &&
    a.bounds.x === b.bounds.x &&
    a.bounds.y === b.bounds.y &&
    a.bounds.width === b.bounds.width &&
    a.bounds.height === b.bounds.height
  )
}

export function useAiViewHost({
  viewId,
  hostToken,
  isHostOwner,
  visible
}: UseAiViewHostOptions): UseAiViewHostResult {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const lastSentRef = useRef<HostSnapshot | null>(null)
  const frameRef = useRef<number | null>(null)
  const isHostOwnerRef = useRef(isHostOwner)
  const visibleRef = useRef(visible)
  isHostOwnerRef.current = isHostOwner
  visibleRef.current = visible

  const measure = useCallback((): AiViewBounds | null => {
    if (!element) return null
    return toBounds(element.getBoundingClientRect(), resolveClipRadius(element))
  }, [element])

  const publish = useCallback(() => {
    if (!isHostOwnerRef.current) return
    const client = getAiViewClient()
    if (!client) return
    const bounds = measure()
    if (!bounds) return
    const snapshot: HostSnapshot = { bounds, visible: visibleRef.current }
    if (snapshotEqual(lastSentRef.current, snapshot)) return
    lastSentRef.current = snapshot
    client.syncHost({ viewId, hostToken, bounds, visible: snapshot.visible })
  }, [hostToken, measure, viewId])

  const schedule = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestFrame(() => {
      frameRef.current = null
      publish()
    })
  }, [publish])

  const flush = useCallback(() => {
    if (frameRef.current !== null) {
      cancelFrame(frameRef.current)
      frameRef.current = null
    }
    publish()
  }, [publish])

  const setHostElement = useCallback((node: HTMLDivElement | null) => {
    setElement(node)
  }, [])

  useEffect(() => {
    if (!element) return

    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null
    observer?.observe(element)

    window.addEventListener('resize', schedule)
    // Panels animate their bounds, so scroll/resize ancestors move the host
    // without firing a ResizeObserver entry on the host itself.
    window.addEventListener('scroll', schedule, true)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      if (frameRef.current !== null) {
        cancelFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [element, schedule])

  // Ownership change and visibility flips both need an immediate push: the
  // bounds may be unchanged while the required action is only show or hide.
  useEffect(() => {
    if (!isHostOwner || !element) return
    flush()
  }, [element, flush, isHostOwner, visible])

  return { setHostElement, flush }
}
