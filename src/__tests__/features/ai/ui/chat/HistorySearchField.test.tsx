import HistorySearchField from '@features/ai/ui/chat/HistorySearchField'

import { act, render, screen } from '@testing-library/react'
import { type ComponentProps, createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

function domRect({ left = 0, right = 0, width = 0 } = {}): DOMRect {
  return {
    left,
    right,
    width,
    top: 0,
    bottom: 40,
    height: 40,
    x: left,
    y: 0,
    toJSON: () => ({})
  } as DOMRect
}

function renderField(overrides: Partial<ComponentProps<typeof HistorySearchField>> = {}) {
  return render(
    <HistorySearchField
      value="alpha"
      isSearchActive
      isSearchPending={false}
      resultCount={1200}
      inputRef={createRef<HTMLInputElement>()}
      onChange={vi.fn()}
      onClear={vi.fn()}
      {...overrides}
    />
  )
}

/** Lets the test drive the component's ResizeObserver callback by hand. */
let resizeCallback: (() => void) | null = null

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback as unknown as () => void
  }
  observe() {}
  unobserve() {}
  disconnect() {
    resizeCallback = null
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  resizeCallback = null
})

describe('HistorySearchField', () => {
  it('reserves the measured width of the counter/clear rail', () => {
    // A wide counter used to run under a fixed 7rem padding. The field now
    // reserves the rail it actually renders: 420 - 300 = 120, plus the 6px gap.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.dataset.testid === 'history-search-rail') {
        return domRect({ left: 300, right: 400, width: 100 })
      }
      if (this.dataset.testid === 'history-search-field') {
        return domRect({ left: 0, right: 420, width: 420 })
      }
      return domRect()
    })

    renderField()

    const input = screen.getByTestId('history-search-input')
    expect(input).toHaveStyle({ paddingRight: '126px' })
    // No fixed reserve once the measurement owns the value.
    expect(input).not.toHaveClass('pr-28')
  })

  it('returns the field to its normal padding when the rail becomes empty', () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    let railPresent = true
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.dataset.testid === 'history-search-rail') {
        return railPresent
          ? domRect({ left: 300, right: 400, width: 100 })
          : domRect({ left: 400, right: 400, width: 0 })
      }
      if (this.dataset.testid === 'history-search-field') {
        return domRect({ left: 0, right: 420, width: 420 })
      }
      return domRect()
    })

    renderField()
    const input = screen.getByTestId('history-search-input')
    expect(input).toHaveStyle({ paddingRight: '126px' })

    // Clearing the query removes both the badge and the clear button; the rail
    // reports zero width and the last reserve must not stick around.
    railPresent = false
    act(() => resizeCallback?.())

    expect(input.style.paddingRight).toBe('')
    expect(input).not.toHaveClass('pr-28')
  })

  it('shows a pending marker instead of an empty badge while searching', () => {
    renderField({ isSearchActive: true, isSearchPending: true })

    const badge = screen.getByTestId('history-search-count')
    expect(badge).toHaveTextContent('…')
    expect(badge.getAttribute('aria-label')).toBeTruthy()
  })

  it('renders the count and clear controls in the rail when a query is active', () => {
    renderField()

    const rail = screen.getByTestId('history-search-rail')
    expect(rail).toContainElement(screen.getByTestId('history-search-count'))
    expect(rail).toContainElement(screen.getByTestId('history-search-clear'))
  })
})
