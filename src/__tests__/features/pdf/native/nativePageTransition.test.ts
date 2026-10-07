/**
 * The page turn's presentation contract, as pure values.
 *
 * ## What is pinned here
 *
 * Four things a regression would undo and a browser cannot tell us about:
 *
 *  1. **Direction is a page-number comparison.** Forward, backward, and "the page did not
 *     change". Not the wheel's delta — a toolbar button and an internal link have no
 *     delta — and not a step count, because a link from page 5 to page 32 is one turn.
 *  2. **Only compositor properties are animated.** The keyframe list is the whole set of
 *     properties a turn touches, so a `top`/`height`/`filter` animation added later fails
 *     here rather than showing up as a janky page in a 400-page textbook.
 *  3. **The timing is the project's timing.** `--duration-normal` and `--ease-glass`,
 *     mirrored, so the page turn cannot quietly drift to 400 ms while every menu in the
 *     app stays at 140 ms.
 *  4. **Reduced motion and a host without WAAPI both decline to animate**, and declining
 *     is not throwing.
 *
 * ## What jsdom cannot tell us
 *
 * jsdom has no `Element.animate`, so these tests install a recorder. That makes the
 * *arguments* the presentation is created with an asserted contract — which is the part
 * that is decided in this repository — while the interpolation itself stays the browser's
 * problem. `nativePageTransitionViewer.test.tsx` covers the other half: that a turn is
 * requested for the right page, in the right direction, exactly once.
 */
import {
  NATIVE_PAGE_TRANSITION_DURATION_MS,
  NATIVE_PAGE_TRANSITION_EASING,
  NATIVE_PAGE_TRANSITION_OFFSET_PX,
  deriveNativePdfPageTransitionDirection,
  nativePdfPageTransitionKeyframes,
  playNativePdfPageTransition
} from '@features/pdf/native/nativePdfPageTransition'
import { prefersReducedMotion } from '@features/pdf/native/nativePdfReducedMotion'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface AnimateCall {
  element: Element
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions | number | undefined
}

let animateCalls: AnimateCall[]
let cancel: ReturnType<typeof vi.fn>
let originalAnimate: Element['animate'] | undefined

/**
 * Install a recorder in place of the Web Animations API.
 *
 * jsdom does not implement `Element.animate`, which is the same situation
 * `playNativePdfPageTransition` treats as "no presentation", so this stands in for the
 * browser without pretending to interpolate anything.
 */
function installAnimateRecorder(): void {
  animateCalls = []
  cancel = vi.fn()
  originalAnimate = Element.prototype.animate
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: Keyframe[],
    options?: KeyframeAnimationOptions | number
  ) {
    animateCalls.push({ element: this, keyframes, options })
    return { cancel, finished: Promise.resolve(this) } as unknown as Animation
  } as Element['animate']
}

beforeEach(() => {
  installAnimateRecorder()
})

afterEach(() => {
  if (originalAnimate) {
    Element.prototype.animate = originalAnimate
  } else {
    delete (Element.prototype as { animate?: Element['animate'] }).animate
  }
  vi.unstubAllGlobals()
})

describe('page transition direction', () => {
  it('calls a higher page number forward and a lower one backward', () => {
    expect(deriveNativePdfPageTransitionDirection(26, 27)).toBe('forward')
    expect(deriveNativePdfPageTransitionDirection(27, 26)).toBe('backward')
  })

  it('has no direction when the page did not change', () => {
    // A clamped `setCurrentPage` returns the value it already had, so "no turn" has to be
    // a value the machine can be handed rather than an error.
    expect(deriveNativePdfPageTransitionDirection(12, 12)).toBe(null)
  })

  it('treats a jump of any size as exactly one turn', () => {
    // An internal PDF link from page 5 to page 32 is one forward presentation, not
    // twenty-seven of them queued.
    expect(deriveNativePdfPageTransitionDirection(5, 32)).toBe('forward')
    expect(deriveNativePdfPageTransitionDirection(32, 5)).toBe('backward')
    expect(deriveNativePdfPageTransitionDirection(1, 999)).toBe('forward')
  })
})

describe('page transition keyframes', () => {
  it('enters forward from below and backward from above', () => {
    const [forward, backward] = [
      nativePdfPageTransitionKeyframes('forward')[0],
      nativePdfPageTransitionKeyframes('backward')[0]
    ]

    // Forward enters from the direction the wheel was turning: the page comes up from
    // below. Backward is the mirror, so the motion always agrees with the navigation.
    expect(forward.transform).toBe(`translateY(${NATIVE_PAGE_TRANSITION_OFFSET_PX}px)`)
    expect(backward.transform).toBe(`translateY(-${NATIVE_PAGE_TRANSITION_OFFSET_PX}px)`)
  })

  it('settles onto the page box resting style', () => {
    const last = nativePdfPageTransitionKeyframes('forward').at(-1)

    // `fill: 'none'` is only safe because the final keyframe *is* the resting style, so
    // the element is already where it belongs when the animation is dropped.
    expect(last).toEqual({ opacity: 1, transform: 'translateY(0px)' })
  })

  it('starts from an opacity floor rather than from nothing', () => {
    const [first] = nativePdfPageTransitionKeyframes('forward')

    // Zero would put a black rectangle in the first composited frame of every turn — the
    // blank-frame flash the single-canvas architecture otherwise never produces.
    expect(first.opacity).toBeGreaterThan(0)
    expect(first.opacity).toBeLessThan(1)
  })

  it('animates only properties a compositor owns', () => {
    const properties = nativePdfPageTransitionKeyframes('forward').flatMap((frame) =>
      Object.keys(frame)
    )

    // Layout-triggering and paint-heavy properties are the whole list this phase refuses.
    // A turn that added `height`, `filter` or `box-shadow` would fail here.
    expect([...new Set(properties)].sort()).toEqual(['opacity', 'transform'])
  })

  it('animates no scale, rotation, perspective or overshoot', () => {
    const serialized = JSON.stringify(nativePdfPageTransitionKeyframes('forward'))

    // Text that scales for even one frame is text the reader cannot read. `100%` would
    // also catch a percentage translate; the ramp is deliberately pixel-denominated.
    expect(serialized).not.toMatch(/scale|rotate|perspective|matrix|100%/)
  })
})

describe('page transition timing', () => {
  it('uses the shared normal duration rather than a private number', () => {
    // `--duration-normal`: the same 140 ms as the dialogs, the menus and the search bar.
    // A turn that felt like a different product would start here.
    expect(NATIVE_PAGE_TRANSITION_DURATION_MS).toBe(140)
  })

  it('uses the shared glass easing', () => {
    expect(NATIVE_PAGE_TRANSITION_EASING).toBe('cubic-bezier(0.2, 0.9, 0.22, 1)')
  })
})

describe('playing a page turn', () => {
  it('animates the page box with the direction keyframes', () => {
    const page = document.createElement('div')

    playNativePdfPageTransition(page, 'backward', false)

    expect(animateCalls).toHaveLength(1)
    expect(animateCalls[0].element).toBe(page)
    expect(animateCalls[0].keyframes).toEqual(nativePdfPageTransitionKeyframes('backward'))
  })

  it('requests the shared duration, easing and no fill', () => {
    const page = document.createElement('div')

    playNativePdfPageTransition(page, 'forward', false)

    // `fill: 'none'` is load-bearing: the last keyframe is the resting style, so nothing
    // may be left behind on the element after the animation ends.
    expect(animateCalls[0].options).toEqual({
      duration: 140,
      easing: 'cubic-bezier(0.2, 0.9, 0.22, 1)',
      fill: 'none'
    })
  })

  it('declines to animate anything when the reader asked for reduced motion', () => {
    const page = document.createElement('div')

    const animation = playNativePdfPageTransition(page, 'forward', true)

    // No animation object at all rather than a zero-length one: there is no translate to
    // suppress and no opacity ramp to shorten, and a returned `Animation` would imply
    // there was still something running.
    expect(animation).toBe(null)
    expect(animateCalls).toHaveLength(0)
  })

  it('declines to animate on a host without the Web Animations API', () => {
    // jsdom before the recorder, and any old WebView: navigation is unaffected and the
    // page simply appears.
    delete (Element.prototype as { animate?: Element['animate'] }).animate
    const page = document.createElement('div')

    expect(playNativePdfPageTransition(page, 'forward', false)).toBe(null)
  })
})

describe('reading the motion preference', () => {
  function stubMatchMedia(matches: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })
  }

  it('reports the reduced-motion answer', () => {
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)

    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('asks about the reduce query, not about some other condition', () => {
    stubMatchMedia(true)

    prefersReducedMotion()

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('treats a host with no matchMedia as having no preference', () => {
    // The absence of the API is not a request for reduced motion — it is a host that
    // cannot answer, and the safe reading of that is "animate normally".
    Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined })

    expect(prefersReducedMotion()).toBe(false)
  })

  it('treats a throwing media-query layer as having no preference', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => {
        throw new Error('media queries are unavailable')
      })
    })

    expect(prefersReducedMotion()).toBe(false)
  })
})
