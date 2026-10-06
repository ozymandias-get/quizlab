/**
 * Regression tests for the search highlight renderer.
 *
 * `usePdfPlugins` hands `safeRenderHighlights` to the viewer's search plugin and
 * that function owns everything the app does with a match: the class the
 * search plugin's stylesheet targets, the deferred fade-in (dozens of highlight
 * divs must not compete with page rasterization), and the reduced-motion
 * variant.
 *
 * The renderer is not exported, so the plugin factories are mocked and the
 * `renderHighlights` option they receive is captured and then driven directly.
 * That keeps the real implementation under test and lets the assertions run
 * against the actual DOM the viewer would mount, rather than against the fact
 * that a callback was invoked.
 */
import type { HighlightArea, RenderHighlightsProps } from '@react-pdf-viewer/search'

import { render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RenderHighlights = (props: RenderHighlightsProps) => React.ReactElement

const mocks = vi.hoisted(() => ({
  pageNavigationPlugin: vi.fn(),
  searchPlugin: vi.fn(),
  zoomPlugin: vi.fn(),
  jumpToPage: vi.fn(),
  zoomTo: vi.fn(),
  highlight: vi.fn(),
  clearHighlights: vi.fn(),
  renderHighlights: null as unknown
}))

vi.mock('@react-pdf-viewer/page-navigation', () => ({
  pageNavigationPlugin: mocks.pageNavigationPlugin
}))

vi.mock('@react-pdf-viewer/search', () => ({
  searchPlugin: mocks.searchPlugin
}))

vi.mock('@react-pdf-viewer/zoom', () => ({
  zoomPlugin: mocks.zoomPlugin
}))

/** The class the search plugin's stylesheet positions; see `_pdf-viewer.css`. */
const HIGHLIGHT_CLASS = 'rpv-search__highlight'
const FADE_ANIMATION = 'pdf-highlight-fadein'

let matchMediaMatches: boolean
let matchMediaSpy: ReturnType<typeof vi.spyOn>

function installMatchMedia(matches: boolean) {
  matchMediaMatches = matches
  matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }) as unknown as MediaQueryList
  )
}

function makeArea(overrides: Partial<HighlightArea> = {}): HighlightArea {
  return {
    keyword: /fox/,
    keywordStr: 'fox',
    numPages: 3,
    pageIndex: 1,
    left: 12,
    top: 34,
    height: 16,
    width: 40,
    pageHeight: 1123,
    pageWidth: 794,
    ...overrides
  }
}

function makeProps(areas: HighlightArea[]): RenderHighlightsProps {
  return {
    highlightAreas: areas,
    getCssProperties: (area) => ({
      left: `${area.left}px`,
      top: `${area.top}px`,
      width: `${area.width}px`,
      height: `${area.height}px`
    })
  }
}

/**
 * Mount the hook and return the renderer it handed to the search plugin.
 * The module is re-imported per test so the cached reduced-motion preference
 * cannot leak between cases.
 */
async function captureRenderer(): Promise<RenderHighlights> {
  vi.resetModules()
  const { usePdfPlugins } = await import('@features/pdf/ui/hooks/usePdfPlugins')
  renderHook(() => usePdfPlugins())
  return mocks.renderHighlights as RenderHighlights
}

describe('search highlight rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.renderHighlights = null
    installMatchMedia(false)
    mocks.pageNavigationPlugin.mockReturnValue({ jumpToPage: mocks.jumpToPage })
    mocks.searchPlugin.mockImplementation((props?: { renderHighlights?: RenderHighlights }) => {
      mocks.renderHighlights = props?.renderHighlights
      return {
        highlight: mocks.highlight,
        clearHighlights: mocks.clearHighlights
      }
    })
    mocks.zoomPlugin.mockReturnValue({
      ZoomIn: () => null,
      ZoomOut: () => null,
      CurrentScale: () => null,
      zoomTo: mocks.zoomTo
    })
  })

  afterEach(() => {
    matchMediaSpy.mockRestore()
  })

  it('is registered as the search plugin render option', async () => {
    await captureRenderer()

    expect(mocks.renderHighlights).toBeTypeOf('function')
  })

  describe('geometry', () => {
    it('places one highlight using the coordinates the plugin computed', async () => {
      const renderHighlights = await captureRenderer()
      const area = makeArea({ left: 12, top: 34, width: 40, height: 16 })

      const { container } = render(renderHighlights(makeProps([area])))
      const highlights = container.querySelectorAll(`.${HIGHLIGHT_CLASS}`)

      expect(highlights).toHaveLength(1)
      const highlight = highlights[0] as HTMLElement
      expect(highlight.style.left).toBe('12px')
      expect(highlight.style.top).toBe('34px')
      expect(highlight.style.width).toBe('40px')
      expect(highlight.style.height).toBe('16px')
      expect(highlight.getAttribute('data-index')).toBe('0')
    })

    it('renders every match in order, each with its own index', async () => {
      const renderHighlights = await captureRenderer()
      const areas = [
        makeArea({ keywordStr: 'first', left: 1 }),
        makeArea({ keywordStr: 'second', left: 2 }),
        makeArea({ keywordStr: 'third', left: 3 })
      ]

      const { container } = render(renderHighlights(makeProps(areas)))
      const highlights = [...container.querySelectorAll(`.${HIGHLIGHT_CLASS}`)]

      expect(highlights).toHaveLength(3)
      expect(highlights.map((el) => el.getAttribute('data-index'))).toEqual(['0', '1', '2'])
      expect(highlights.map((el) => el.getAttribute('title'))).toEqual(['first', 'second', 'third'])
    })

    it('uses the keyword as the accessible title, trimmed', async () => {
      const renderHighlights = await captureRenderer()

      const { container } = render(
        renderHighlights(makeProps([makeArea({ keywordStr: '  fox  ' })]))
      )

      expect(container.querySelector(`.${HIGHLIGHT_CLASS}`)?.getAttribute('title')).toBe('fox')
    })

    it('emits an empty title when the area carries no keyword string', async () => {
      const renderHighlights = await captureRenderer()

      const { container } = render(
        renderHighlights(makeProps([makeArea({ keywordStr: undefined as unknown as string })]))
      )

      const highlight = container.querySelector(`.${HIGHLIGHT_CLASS}`)
      expect(highlight?.getAttribute('title')).toBe('')
    })

    it('renders a single highlight for a match that spans several lines', async () => {
      const renderHighlights = await captureRenderer()
      // A keyword broken across a line break is one match with a bounding box
      // that spans both lines. The renderer must not split it into per-line divs,
      // because the plugin hands over a single area.
      const spanning = makeArea({ top: 100, height: 34, width: 120 })

      const { container } = render(renderHighlights(makeProps([spanning])))

      const highlights = container.querySelectorAll(`.${HIGHLIGHT_CLASS}`)
      expect(highlights).toHaveLength(1)
      expect((highlights[0] as HTMLElement).style.height).toBe('34px')
    })
  })

  describe('guard behaviour', () => {
    it('renders nothing when there are no matches', async () => {
      const renderHighlights = await captureRenderer()

      const { container } = render(renderHighlights(makeProps([])))

      expect(container.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(0)
    })

    it('renders nothing when the highlight list is missing', async () => {
      const renderHighlights = await captureRenderer()

      const { container } = render(
        renderHighlights({ getCssProperties: () => ({}) } as unknown as RenderHighlightsProps)
      )

      expect(container.innerHTML).toBe('')
    })

    it('renders nothing when the highlight list is not an array', async () => {
      const renderHighlights = await captureRenderer()

      const { container } = render(
        renderHighlights({
          highlightAreas: 'nope',
          getCssProperties: () => ({})
        } as unknown as RenderHighlightsProps)
      )

      expect(container.innerHTML).toBe('')
    })

    it('renders nothing when called with no props at all', async () => {
      const renderHighlights = await captureRenderer()

      const { container } = render(renderHighlights(undefined as unknown as RenderHighlightsProps))

      expect(container.innerHTML).toBe('')
    })

    it('still renders when the plugin provides no css helper', async () => {
      const renderHighlights = await captureRenderer()

      const { container } = render(
        renderHighlights({ highlightAreas: [makeArea()] } as unknown as RenderHighlightsProps)
      )

      const highlights = container.querySelectorAll(`.${HIGHLIGHT_CLASS}`)
      expect(highlights).toHaveLength(1)
      // Without geometry the highlight keeps only the animation state.
      expect((highlights[0] as HTMLElement).style.left).toBe('')
    })
  })

  describe('fade animation', () => {
    it('defers the fade-in so the highlights do not fight page rasterization', async () => {
      installMatchMedia(false)
      const renderHighlights = await captureRenderer()

      const { container } = render(renderHighlights(makeProps([makeArea()])))
      const highlight = container.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement

      expect(matchMediaMatches).toBe(false)
      expect(highlight.style.opacity).toBe('0')
      expect(highlight.style.animation).toContain(FADE_ANIMATION)
      // The delay is the deliberate duration token, the timing the normal one.
      expect(highlight.style.animation).toContain('var(--duration-normal)')
      expect(highlight.style.animation).toContain('var(--duration-deliberate)')
      expect(highlight.style.animation).toContain('forwards')
    })

    it('shows a static dimmed highlight when reduced motion is requested', async () => {
      installMatchMedia(true)
      const renderHighlights = await captureRenderer()

      const { container } = render(renderHighlights(makeProps([makeArea()])))
      const highlight = container.querySelector(`.${HIGHLIGHT_CLASS}`) as HTMLElement

      expect(matchMediaMatches).toBe(true)
      expect(highlight.style.opacity).toBe('0.3')
      // No animation at all: a fade is exactly what the user asked to avoid.
      expect(highlight.style.animation).toBe('')
    })

    it('keeps the geometry alongside either animation mode', async () => {
      const area = makeArea({ left: 7, top: 9, width: 11, height: 13 })

      installMatchMedia(false)
      const animated = await captureRenderer()
      const animatedEl = render(animated(makeProps([area]))).container.querySelector(
        `.${HIGHLIGHT_CLASS}`
      ) as HTMLElement

      installMatchMedia(true)
      const still = await captureRenderer()
      const stillEl = render(still(makeProps([area]))).container.querySelector(
        `.${HIGHLIGHT_CLASS}`
      ) as HTMLElement

      for (const el of [animatedEl, stillEl]) {
        expect(el.style.left).toBe('7px')
        expect(el.style.top).toBe('9px')
        expect(el.style.width).toBe('11px')
        expect(el.style.height).toBe('13px')
      }
    })
  })
})
