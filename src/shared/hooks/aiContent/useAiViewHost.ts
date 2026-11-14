import type { AiViewBounds } from '@shared-core/types/aiView'

import { useCallback, useEffect, useRef, useState } from 'react'

import { getAiViewClient } from './aiViewClient'

/**
 * Keeps a main-process `WebContentsView` aligned with a React host placeholder.
 *
 * A native view is not in the DOM, so its geometry has to be mirrored from
 * `getBoundingClientRect()`. Four rules keep this cheap and deterministic:
 *
 * 1. Exactly one host writes. `isHostOwner` is true only for the host that
 *    currently owns the view (active surface + active tab), so a placeholder
 *    that is still mounted behind a focus-mode animation never fights the one
 *    in front.
 * 2. Updates are coalesced into a single animation frame, so a resize drag
 *    cannot flood IPC.
 * 3. Identical messages are dropped, so React re-renders that do not change the
 *    host produce no traffic at all. Everything the main process would act on —
 *    rectangle, corner radius, visibility — is part of that identity.
 * 4. Every source of movement is observed, not just size. `ResizeObserver`,
 *    `resize` and `scroll` all miss a host that is *translated*: a layout swap
 *    flips a class on `main`, and a JS-driven transform animation rewrites an
 *    ancestor's inline style every frame, while the host's border box keeps its
 *    width and height and no scroll or resize happens. The host therefore
 *    watches its ancestor chain for class/style mutations and the document for
 *    CSS animation/transition events, and re-measures on the next frame.
 *
 *    A CSS transition is the one case neither of those sees per frame: the
 *    browser interpolates the computed value while the attributes stay put. Its
 *    two events therefore bracket a *bounded* per-frame follow ({@link
 *    MOTION_WATCH_MAX_FRAMES} frames at most), which stops on the end event or
 *    on the budget, whichever comes first. Nothing runs between changes, and the
 *    dedupe above means a watched frame that measures the same rectangle still
 *    sends nothing.
 */

const MOTION_START_EVENTS = ['transitionrun', 'animationstart'] as const
const MOTION_END_EVENTS = [
  'transitionend',
  'transitioncancel',
  'animationend',
  'animationcancel'
] as const

interface UseAiViewHostOptions {
  viewId: string
  /** Identity of this host. Only the current owner may move the view. */
  hostToken: string
  /** Whether this host is the single writer for the view. */
  isHostOwner: boolean
  /** Whether the native view should currently be on screen. */
  visible: boolean
}

interface UseAiViewHostResult {
  setHostElement: (element: HTMLDivElement | null) => void
  /** Pushes the current rectangle immediately, bypassing frame coalescing. */
  flush: () => void
  /**
   * Pushes the current rectangle on the next animation frame even when it is
   * identical to the last one that was sent, re-asserting it over the next
   * {@link REASSERT_FRAMES} frames.
   *
   * Geometry is fire-and-forget and the host dedupes its own sends, which is what
   * keeps a re-render from producing traffic — but it also means the host cannot
   * learn that the main process *dropped* a message: `syncAiViewHost` rejects one
   * naming a view it does not own yet, or one whose token belongs to a host that
   * is gone. Re-sending unconditionally is therefore the only way to guarantee the
   * main process holds a rectangle from this host once it starts owning the view.
   *
   * Deferred by a frame so React has committed whatever state prompted the call,
   * and it reads its inputs at send time, so it can only ever be newer than what
   * was already sent.
   */
  republish: () => void
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

/**
 * Frames a re-assertion spans.
 *
 * The main process drops a sync naming a view it does not own yet and never
 * acknowledges the ones it keeps, so a re-assertion gets exactly one chance per
 * frame and no way to learn whether the message landed. A single frame was
 * enough whenever the attach that would have made it deliverable had already
 * resolved — and not otherwise: attach awaits its target resolution first, so
 * the very first rectangle a host publishes is also the one most likely to be
 * judged against a view that does not exist yet, or against a token left behind
 * by a renderer that no longer does. Spreading the re-assertion over a few
 * frames costs a handful of no-op messages per attach and closes that window.
 */
const REASSERT_FRAMES = 3

/**
 * Frames a running CSS transition or animation is followed for.
 *
 * A transition moves the host without mutating its attributes: the browser
 * interpolates the computed value and only `transitionrun` / `transitionend`
 * report it. Without a per-frame measurement the native view stays at the
 * transition's start rectangle until it ends — visibly behind the panel for the
 * whole animation. The watch below therefore measures once per frame while the
 * animation runs, and stops on its end event.
 *
 * This is a *bounded* follow, not a loop: {@link MOTION_WATCH_MAX_FRAMES} is the
 * safety cap for an animation that never reports an end (an infinite keyframe
 * animation, a transition cancelled without an event). Nothing starts it except
 * an actual motion event, and the snapshot dedupe still drops every frame that
 * measures the same rectangle.
 */
const MOTION_WATCH_MAX_FRAMES = 180

/**
 * Pixels the native view can be placed at.
 *
 * Both edges of each axis are rounded, and the size is derived from them, rather
 * than rounding origin and size independently: at fractional layout positions
 * (125% scaling, a window resized to an odd width) `round(left) + round(width)`
 * lands up to a pixel away from `round(right)`, so the right and bottom edges
 * drift from the DOM box by a pixel that the top and left edges do not have.
 * Deriving the size from the rounded boundaries keeps the rectangle exactly
 * between them, so neither edge can accumulate the error.
 *
 * Everything here is an integer because `View.setBounds` takes integer
 * device-independent pixels; the corner radius is separately measured and
 * already integer (see `resolveClipRadius`).
 */
function toBounds(rect: DOMRect, borderRadius: number): AiViewBounds {
  const x = Math.max(0, Math.round(rect.left))
  const y = Math.max(0, Math.round(rect.top))
  return {
    x,
    y,
    width: Math.max(0, Math.round(rect.right) - x),
    height: Math.max(0, Math.round(rect.bottom) - y),
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
 * Two details decide whether the corner actually lines up:
 *
 * 1. Per-corner inner radius. The panel's border width is subtracted because the
 *    host sits inside the border box: a 16px radius around a 1px border leaves
 *    the content corner at 15px. Every corner is measured, not just the top-left
 *    one, because `setBorderRadius` is uniform — the *smallest* inner corner is
 *    the only value that cannot paint over any of them. A panel that only rounds
 *    its top edge therefore yields 0, which is square and safe, instead of
 *    over-clipping the bottom.
 * 2. An integer. Electron's `View.setBorderRadius` is declared as `Integer`; a
 *    fractional radius — `1.25rem` at a 15px root minus a 1px border is 17.75px —
 *    is rejected by the argument converter and the call throws, leaving the view
 *    square with only a warning in the log. Rounding here is what makes the
 *    native corner line up with the CSS corner instead of silently not existing.
 *
 * Reading all of it from the DOM also means a theme, density or radius change is
 * picked up for free instead of being hard-coded here.
 */
const CORNER_PROPERTIES = [
  ['borderTopLeftRadius', 'borderTopWidth', 'borderLeftWidth'],
  ['borderTopRightRadius', 'borderTopWidth', 'borderRightWidth'],
  ['borderBottomRightRadius', 'borderBottomWidth', 'borderRightWidth'],
  ['borderBottomLeftRadius', 'borderBottomWidth', 'borderLeftWidth']
] as const

/** Reads a computed length in CSS pixels; anything else counts as absent. */
function computedPixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * The tightest inner corner of one element, or 0 when it cannot be rounded.
 *
 * A single square corner means a uniform radius would either over-clip the
 * rounded ones or paint over the square one, so the element is reported as not
 * roundable. Each corner loses its own border width — the wider of the two edges
 * meeting there, which is the safe side for a non-uniform border — because the
 * host sits inside the border box.
 */
function innerCornerRadius(style: CSSStyleDeclaration): number {
  let smallest = Number.POSITIVE_INFINITY
  for (const [radiusProperty, firstBorder, secondBorder] of CORNER_PROPERTIES) {
    const radius = computedPixels(style[radiusProperty])
    if (radius <= 0) return 0
    const border = Math.max(computedPixels(style[firstBorder]), computedPixels(style[secondBorder]))
    smallest = Math.min(smallest, radius - border)
  }
  return Number.isFinite(smallest) ? Math.max(0, smallest) : 0
}

function resolveClipRadius(element: HTMLElement): number {
  if (typeof window.getComputedStyle !== 'function') return 0
  let node: HTMLElement | null = element
  while (node instanceof HTMLElement && node !== document.body) {
    const style = window.getComputedStyle(node)
    const clips = style.overflowX === 'hidden' || style.overflowY === 'hidden'
    if (clips) {
      const radius = innerCornerRadius(style)
      if (radius > 0) return Math.round(radius)
    }
    node = node.parentElement
  }
  return 0
}

/**
 * Two snapshots are the same message only if the main process would derive the
 * same result from them.
 *
 * `borderRadius` is part of that: it travels with the rectangle and is applied in
 * the same step as `setBounds`, so leaving it out made a radius-only change — a
 * theme or density switch, a different panel wrapping the same host — compare
 * equal and be dropped. The native view then kept the previous corner radius
 * while painting the new bounds.
 */
function snapshotEqual(a: HostSnapshot | null, b: HostSnapshot): boolean {
  return (
    a !== null &&
    a.visible === b.visible &&
    a.bounds.x === b.bounds.x &&
    a.bounds.y === b.bounds.y &&
    a.bounds.width === b.bounds.width &&
    a.bounds.height === b.bounds.height &&
    (a.bounds.borderRadius ?? 0) === (b.bounds.borderRadius ?? 0)
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
  const reassertFramesRef = useRef(0)
  const isHostOwnerRef = useRef(isHostOwner)
  const visibleRef = useRef(visible)
  isHostOwnerRef.current = isHostOwner
  visibleRef.current = visible

  /**
   * Motion watch state: one frame handle, a budget, and how many motion events
   * are still unaccounted for. Kept in refs so starting or stopping the watch
   * never re-renders the host.
   */
  const motionFrameRef = useRef<number | null>(null)
  const motionFramesLeftRef = useRef(0)
  const motionEventsRef = useRef(0)

  const measure = useCallback((): AiViewBounds | null => {
    if (!element) return null
    return toBounds(element.getBoundingClientRect(), resolveClipRadius(element))
  }, [element])

  const publish = useCallback(
    (force: boolean): boolean => {
      if (!isHostOwnerRef.current) return false
      if (
        !force &&
        !visibleRef.current &&
        lastSentRef.current !== null &&
        !lastSentRef.current.visible
      ) {
        return false
      }
      const client = getAiViewClient()
      if (!client) return true
      const bounds = measure()
      // Nothing to measure means the placeholder is gone; no number of further
      // frames will produce a rectangle.
      if (!bounds) return false
      const snapshot: HostSnapshot = { bounds, visible: visibleRef.current }
      if (!force && snapshotEqual(lastSentRef.current, snapshot)) return false
      lastSentRef.current = snapshot
      client.syncHost({ viewId, hostToken, bounds, visible: snapshot.visible })
      return true
    },
    [hostToken, measure, viewId]
  )

  const schedule = useCallback(() => {
    if (!isHostOwnerRef.current && reassertFramesRef.current <= 0) return
    if (frameRef.current !== null) return
    frameRef.current = requestFrame(() => {
      frameRef.current = null
      if (reassertFramesRef.current <= 0) {
        publish(false)
        return
      }
      reassertFramesRef.current -= 1
      // Re-arm only while frames remain and there is still something to measure,
      // so a re-assertion costs exactly `REASSERT_FRAMES` frames and an unmount
      // mid-flight ends it instead of looping.
      if (publish(true) && reassertFramesRef.current > 0) schedule()
    })
  }, [publish])

  const flush = useCallback(() => {
    if (frameRef.current !== null) {
      cancelFrame(frameRef.current)
      frameRef.current = null
    }
    publish(false)
  }, [publish])

  const republish = useCallback(() => {
    reassertFramesRef.current = REASSERT_FRAMES
    schedule()
  }, [schedule])

  /**
   * Measures once per frame while a transition or animation is moving the host.
   *
   * `publish(false)` is the same path a resize takes, so the corner radius,
   * visibility and dedupe rules are unchanged; the watch only decides *when* to
   * measure. The budget shrinks every tick and nothing re-arms it, so a motion
   * that never reports an end still costs at most {@link MOTION_WATCH_MAX_FRAMES}
   * frames and then stops for good.
   */
  const startMotionWatch = useCallback(() => {
    // A motion that begins while another is already being followed shares the
    // remaining budget instead of re-arming it. Resetting here let a stream of
    // overlapping events — one `transitionrun` per animated property, a class
    // toggled on a timer — keep the follow alive indefinitely, which is the one
    // thing the cap exists to prevent. A motion that starts after the previous
    // follow has ended is a new session and gets a fresh budget.
    if (motionFrameRef.current !== null) return
    motionFramesLeftRef.current = MOTION_WATCH_MAX_FRAMES
    const tick = () => {
      motionFrameRef.current = null
      if (motionFramesLeftRef.current <= 0) return
      motionFramesLeftRef.current -= 1
      publish(false)
      if (motionFramesLeftRef.current > 0 && motionEventsRef.current > 0) {
        motionFrameRef.current = requestFrame(tick)
      }
    }
    motionFrameRef.current = requestFrame(tick)
  }, [publish])

  const stopMotionWatch = useCallback(() => {
    motionFramesLeftRef.current = 0
    if (motionFrameRef.current !== null) {
      cancelFrame(motionFrameRef.current)
      motionFrameRef.current = null
    }
  }, [])

  const setHostElement = useCallback((node: HTMLDivElement | null) => {
    setElement(node)
  }, [])

  useEffect(() => {
    // Only a host that can actually move the view needs to watch anything: the
    // owner of the view, while the view is on screen. Ten AI tabs stay mounted,
    // but nine of them are background tabs whose hosts publish nothing — they
    // take their observers when they become visible again, and the immediate
    // flush below reads the current rectangle at that moment. A hidden view
    // cannot lag visually, so nothing is lost by not measuring it.
    if (!element || !isHostOwner || !visible) return

    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null
    observer?.observe(element)

    /**
     * Moves that keep the host's size.
     *
     * A layout swap changes a class on `main` and a motion transform rewrites an
     * ancestor's inline style on every frame; neither resizes the host, so the
     * `ResizeObserver` above stays silent and the view would keep the rectangle
     * it happened to publish first. Watching the ancestor chain for `class` and
     * `style` turns both into one measurement on the next frame, and observes
     * nothing that is not already an ancestor of the host.
     *
     * `class` is in the filter on purpose: the swap is a single class flip, not
     * an animation, so there is no motion event to wait for.
     */
    const attributeObserver =
      typeof MutationObserver === 'function' ? new MutationObserver(() => schedule()) : null
    for (let node: Node | null = element; node; node = node.parentNode) {
      // A test double for the host is not a real `Node`; it has no ancestors to
      // watch, and `MutationObserver.observe` would reject it.
      if (node.nodeType === 1) {
        attributeObserver?.observe(node, { attributes: true, attributeFilter: ['class', 'style'] })
      }
    }

    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && !event.target.contains(element)) {
        return
      }
      schedule()
    }

    /**
     * CSS keyframe animations and transitions are not attribute mutations, so
     * they get their own signal. A transition is the one case no observer can
     * see frame by frame: the browser interpolates the computed value while the
     * element's attributes stay exactly as they are, and only `transitionrun`
     * and `transitionend` ever fire. So the event starts a bounded per-frame
     * measurement, and the matching end event stops it.
     *
     * The counter keeps overlapping transitions alive: `transitionrun` fires per
     * animated property, and the first `transitionend` must not stop a watch that
     * is still covering another one.
     */
    const handleMotionStart = (event: Event) => {
      if (event.target instanceof Node && !event.target.contains(element)) return
      motionEventsRef.current += 1
      startMotionWatch()
    }

    const handleMotionEnd = (event: Event) => {
      if (event.target instanceof Node && !event.target.contains(element)) return
      motionEventsRef.current = Math.max(0, motionEventsRef.current - 1)
      // Publish the settled rectangle on this frame even if the watch was
      // between ticks, then stop: motion never leaves a frame running.
      schedule()
      if (motionEventsRef.current === 0) stopMotionWatch()
    }

    window.addEventListener('resize', schedule)
    // Panels animate their bounds, so scroll/resize ancestors move the host
    // without firing a ResizeObserver entry on the host itself.
    window.addEventListener('scroll', handleScroll, true)
    for (const type of MOTION_START_EVENTS) {
      window.addEventListener(type, handleMotionStart, true)
    }
    for (const type of MOTION_END_EVENTS) {
      window.addEventListener(type, handleMotionEnd, true)
    }

    return () => {
      observer?.disconnect()
      attributeObserver?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', handleScroll, true)
      for (const type of MOTION_START_EVENTS) {
        window.removeEventListener(type, handleMotionStart, true)
      }
      for (const type of MOTION_END_EVENTS) {
        window.removeEventListener(type, handleMotionEnd, true)
      }
      stopMotionWatch()
      motionEventsRef.current = 0
      reassertFramesRef.current = 0
      if (frameRef.current !== null) {
        cancelFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [element, isHostOwner, visible, schedule, startMotionWatch, stopMotionWatch])

  // Ownership change and visibility flips both need an immediate push: the
  // bounds may be unchanged while the required action is only show or hide.
  useEffect(() => {
    if (!isHostOwner || !element) return
    flush()
  }, [element, flush, isHostOwner, visible])

  return { setHostElement, flush, republish }
}
