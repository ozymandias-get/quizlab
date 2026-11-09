import type { PdfTab } from '@features/pdf/hooks/types'
import {
  PDF_TAB_MAX_WIDTH,
  computeTabVisibility,
  getDesiredPdfTabWidth,
  getMaxVisibleTabs,
  getPdfTabStripChromeWidth,
  resolveVisiblePdfTabCount
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

  it('does not reserve the overflow button when no tab will be hidden', () => {
    expect(getMaxVisibleTabs(360, false, { hasOverflow: false })).toBe(2)
    expect(getMaxVisibleTabs(360, false, { hasOverflow: true })).toBe(1)
    expect(getPdfTabStripChromeWidth(false, false)).toBe(
      getPdfTabStripChromeWidth(false, true) - 44
    )
  })
})

describe('getDesiredPdfTabWidth', () => {
  it('caps a long file name at the pill max width', () => {
    expect(getDesiredPdfTabWidth(200, 800)).toBe(PDF_TAB_MAX_WIDTH)
  })
})

describe('resolveVisiblePdfTabCount', () => {
  it('drops a slot when the measured pills no longer fit', () => {
    expect(
      resolveVisiblePdfTabCount({
        current: 3,
        tabWidths: [200, 200, 200],
        availableWidth: 300,
        hasOverflow: true
      })
    ).toBe(2)
  })

  it('recovers a slot when a full pill fits', () => {
    expect(
      resolveVisiblePdfTabCount({
        current: 2,
        tabWidths: [100, 100],
        availableWidth: 600,
        hasOverflow: true
      })
    ).toBe(3)
  })

  it('recovers from zero when the row has room', () => {
    expect(
      resolveVisiblePdfTabCount({
        current: 0,
        tabWidths: [],
        availableWidth: 400,
        hasOverflow: true
      })
    ).toBe(1)
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
