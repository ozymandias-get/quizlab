import type { PdfTab } from '@features/pdf/hooks/types'
import {
  computeTabVisibility,
  getMaxVisibleTabs
} from '@features/pdf/ui/components/pdfTabStripUtils'

import { describe, expect, it } from 'vitest'

const makeTabs = (count: number): PdfTab[] =>
  Array.from({ length: count }, (_, i) => ({ id: `tab-${i}` }) as PdfTab)

describe('getMaxVisibleTabs', () => {
  it('returns 0 when not even one pill fits, so controls are not pushed out', () => {
    expect(getMaxVisibleTabs(120, false)).toBe(0)
  })

  it('scales the pill count with the row width', () => {
    expect(getMaxVisibleTabs(600, false)).toBe(3)
    expect(getMaxVisibleTabs(1000, false)).toBe(6)
  })
})

describe('computeTabVisibility', () => {
  it('moves every tab into overflow when capacity is zero', () => {
    const tabs = makeTabs(3)
    const result = computeTabVisibility(tabs, 'tab-1', 0)
    expect(result.visibleTabs).toEqual([])
    expect(result.overflowTabs).toEqual(tabs)
  })

  it('keeps the active tab in the visible window', () => {
    const tabs = makeTabs(6)
    const result = computeTabVisibility(tabs, 'tab-5', 2)
    expect(result.visibleTabs.map((tab) => tab.id)).toEqual(['tab-4', 'tab-5'])
    expect(result.overflowTabs.map((tab) => tab.id)).toEqual(['tab-0', 'tab-1', 'tab-2', 'tab-3'])
  })
})
