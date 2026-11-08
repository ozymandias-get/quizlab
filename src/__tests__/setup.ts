import '@testing-library/jest-dom/vitest'
import '@shared/i18n/i18next'

import { vi } from 'vitest'

const originalConsoleError = console.error
const ALLOWPOPUPS_WARNING_FRAGMENT = 'non-boolean attribute `allowpopups`'
const REACT_NON_BOOLEAN_ATTR_FORMAT = 'non-boolean attribute `%s`'

function applyConsoleErrorFilter() {
  console.error = (...args: unknown[]) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : ''
    const hasDirectAllowPopupsWarning = firstArg.includes(ALLOWPOPUPS_WARNING_FRAGMENT)
    const hasFormattedAllowPopupsWarning =
      firstArg.includes(REACT_NON_BOOLEAN_ATTR_FORMAT) && args.some((arg) => arg === 'allowpopups')
    const joinedArgs = args.map(String).join(' ')
    const hasAnyAllowPopupsNonBooleanWarning =
      joinedArgs.includes('allowpopups') && joinedArgs.includes('non-boolean attribute')

    if (
      hasDirectAllowPopupsWarning ||
      hasFormattedAllowPopupsWarning ||
      hasAnyAllowPopupsNonBooleanWarning
    ) {
      return
    }
    originalConsoleError(...args)
  }
}

applyConsoleErrorFilter()

if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn()
}

/**
 * jsdom ships no 2D canvas backend, so `getContext('2d')` reports null and logs
 * a "not implemented" error. Several production paths only use the context for
 * fire-and-forget drawing (clearing a canvas, filling a background), and their
 * tests are about the surrounding behaviour rather than the pixels. Give them a
 * context with the standard method surface so those paths run as written.
 *
 * Tests that assert on drawing calls spy on `getContext` themselves, and that
 * spy is restored to this implementation after each test.
 */
type Canvas2DContextStub = Record<string, unknown>

const CANVAS_CONTEXT_METHODS = [
  'arc',
  'beginPath',
  'bezierCurveTo',
  'clearRect',
  'clip',
  'closePath',
  'drawFocusIfNeeded',
  'drawImage',
  'ellipse',
  'fill',
  'fillRect',
  'fillText',
  'lineTo',
  'moveTo',
  'putImageData',
  'quadraticCurveTo',
  'rect',
  'resetTransform',
  'restore',
  'rotate',
  'roundRect',
  'save',
  'scale',
  'setLineDash',
  'setTransform',
  'stroke',
  'strokeRect',
  'strokeText',
  'transform',
  'translate'
] as const

const canvasContexts = new WeakMap<HTMLCanvasElement, Canvas2DContextStub>()

function createCanvas2DContext(canvas: HTMLCanvasElement): Canvas2DContextStub {
  const context: Canvas2DContextStub = {
    canvas,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'ltr',
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0
  }

  for (const method of CANVAS_CONTEXT_METHODS) {
    context[method] = () => undefined
  }

  context.getImageData = (_x: number, _y: number, width: number, height: number) => ({
    colorSpace: 'srgb',
    data: new Uint8ClampedArray(Math.max(0, width * height * 4)),
    height,
    width
  })
  context.createImageData = (width: number, height: number) => ({
    colorSpace: 'srgb',
    data: new Uint8ClampedArray(Math.max(0, width * height * 4)),
    height,
    width
  })
  context.createLinearGradient = () => ({ addColorStop: () => undefined })
  context.createRadialGradient = () => ({ addColorStop: () => undefined })
  context.createPattern = () => ({ setTransform: () => undefined })
  context.getLineDash = () => []
  context.measureText = (text: string) => ({
    actualBoundingBoxAscent: 0,
    actualBoundingBoxDescent: 0,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: 0,
    fontBoundingBoxAscent: 0,
    fontBoundingBoxDescent: 0,
    width: String(text).length * 8
  })
  context.isPointInPath = () => false
  context.isPointInStroke = () => false
  context.getTransform = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })

  return context
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement,
    contextId: string
  ): CanvasRenderingContext2D | null {
    if (contextId !== '2d') return null
    let context = canvasContexts.get(this)
    if (!context) {
      context = createCanvas2DContext(this)
      canvasContexts.set(this, context)
    }
    return context as unknown as CanvasRenderingContext2D
  } as typeof HTMLCanvasElement.prototype.getContext
}

/**
 * jsdom implements form submission far enough to fire the `submit` event and
 * then logs "requestSubmit is not implemented" because it cannot navigate.
 * Tests only care about the event, so dispatch it and stop there. Keeping the
 * event path intact means React `onSubmit` handlers still run normally.
 */
if (typeof HTMLFormElement !== 'undefined') {
  HTMLFormElement.prototype.requestSubmit = function requestSubmit(
    this: HTMLFormElement,
    submitter?: HTMLElement | null
  ) {
    if (submitter) {
      const isFormControl =
        submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
      if (!isFormControl || submitter.type !== 'submit') {
        throw new TypeError('The specified element is not a submit button')
      }
      if (submitter.form !== this) {
        throw new DOMException(
          'The specified element is not owned by this form element',
          'NotFoundError'
        )
      }
    }

    if (!this.noValidate && !this.reportValidity()) return

    this.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: submitter ?? null })
    )
  }
}

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null
  }
  unobserve() {
    return null
  }
  disconnect() {
    return null
  }
} as unknown as typeof IntersectionObserver

if (typeof window !== 'undefined') {
  const origGetComputedStyle = window.getComputedStyle.bind(window)
  window.getComputedStyle = (elt: Element, _pseudoElt?: string | null) => origGetComputedStyle(elt)
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

vi.mock('electron', () => ({
  ipcRenderer: {
    on: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn()
  }
}))

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'fs', {
    value: {
      readFile: vi.fn(),
      writeFile: vi.fn()
    },
    writable: true
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  applyConsoleErrorFilter()
})
