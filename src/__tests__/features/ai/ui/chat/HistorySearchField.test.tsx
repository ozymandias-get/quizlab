import HistorySearchField from '@features/ai/ui/chat/HistorySearchField'

import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
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

function renderField() {
  return render(
    <HistorySearchField
      value="alpha"
      isSearchActive
      isSearchPending={false}
      resultCount={1200}
      inputRef={createRef<HTMLInputElement>()}
      onChange={vi.fn()}
      onClear={vi.fn()}
    />
  )
}

afterEach(() => vi.restoreAllMocks())

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

    expect(screen.getByTestId('history-search-input')).toHaveStyle({ paddingRight: '126px' })
    expect(screen.getByTestId('history-search-input')).toHaveClass('pr-28')
  })

  it('renders the count and clear controls in the rail when a query is active', () => {
    renderField()

    const rail = screen.getByTestId('history-search-rail')
    expect(rail).toContainElement(screen.getByTestId('history-search-count'))
    expect(rail).toContainElement(screen.getByTestId('history-search-clear'))
  })
})
