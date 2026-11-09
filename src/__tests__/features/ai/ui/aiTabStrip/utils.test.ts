import {
  AI_TAB_MAX_WIDTH,
  clamp,
  getAiTabStripChromeWidth,
  getDesiredAiTabWidth,
  getInitialVisibleAiTabs,
  getMaxVisibleAiTabs,
  getVisibleTabIds,
  resolveVisibleAiTabCount
} from '@features/ai/ui/aiTabStrip/aiTabStripUtils'

import type { Tab } from '@app/providers/ai-context'

import { describe, expect, it } from 'vitest'

const makeTabs = (count: number): Tab[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `tab-${i}`,
    modelId: `model-${i}`,
    title: `Tab ${i}`,
    isPinned: false
  }))

describe('getVisibleTabIds', () => {
  // The strip windows to three tabs so a long session does not push the active
  // one off screen. Where the window sits is the whole contract.
  it.each([
    ['no tabs', [], 'tab-0', []],
    ['an undefined list', undefined, 'tab-0', []],
    ['a single tab', makeTabs(1), 'tab-0', ['tab-0']],
    ['two tabs', makeTabs(2), 'tab-0', ['tab-0', 'tab-1']],
    ['exactly three', makeTabs(3), 'tab-1', ['tab-0', 'tab-1', 'tab-2']],
    ['active at the start', makeTabs(10), 'tab-0', ['tab-0', 'tab-1', 'tab-2']],
    ['active one in', makeTabs(10), 'tab-1', ['tab-0', 'tab-1', 'tab-2']],
    ['active in the middle', makeTabs(10), 'tab-5', ['tab-4', 'tab-5', 'tab-6']],
    ['active second-to-last', makeTabs(10), 'tab-8', ['tab-7', 'tab-8', 'tab-9']],
    ['active at the end', makeTabs(10), 'tab-9', ['tab-7', 'tab-8', 'tab-9']],
    ['a four-tab list', makeTabs(4), 'tab-2', ['tab-1', 'tab-2', 'tab-3']],
    // findIndex returns -1 for an unknown id; treating that as "index <= 0" is
    // what keeps a stale active id from hiding the head of the list.
    ['an unknown active id', makeTabs(10), 'unknown', ['tab-0', 'tab-1', 'tab-2']]
  ])('%s shows exactly the windowed ids', (_case, tabs, activeTabId, expected) => {
    expect([...getVisibleTabIds(tabs as Tab[] | undefined, activeTabId)].sort()).toEqual(expected)
  })

  it('uses the measured capacity instead of the old fixed three', () => {
    expect([...getVisibleTabIds(makeTabs(10), 'tab-5', 5)].sort()).toEqual([
      'tab-3',
      'tab-4',
      'tab-5',
      'tab-6',
      'tab-7'
    ])
  })

  it('shows nothing when no pill fits; overflow owns every tab', () => {
    expect([...getVisibleTabIds(makeTabs(4), 'tab-2', 0)]).toEqual([])
  })
})

describe('getMaxVisibleAiTabs', () => {
  it('grows with the row width', () => {
    expect(getMaxVisibleAiTabs(220, { hasHome: true, hasRefresh: true })).toBe(0)
    expect(getMaxVisibleAiTabs(600, { hasHome: true, hasRefresh: true })).toBe(3)
    expect(getMaxVisibleAiTabs(1000, { hasHome: true, hasRefresh: true })).toBe(6)
  })

  it('falls back to three before the row has been measured', () => {
    expect(getMaxVisibleAiTabs(0)).toBe(3)
  })

  it('reserves the same chrome width that the measurement pass subtracts', () => {
    expect(getAiTabStripChromeWidth({ hasHome: true, hasRefresh: true })).toBe(133)
    expect(getAiTabStripChromeWidth()).toBe(69)
  })

  it('does not reserve the overflow button when no tab is hidden', () => {
    expect(getAiTabStripChromeWidth({ hasHome: true, hasRefresh: true, hasOverflow: false })).toBe(
      89
    )
  })

  it('only reserves overflow when the tab list actually exceeds the roomier estimate', () => {
    expect(getInitialVisibleAiTabs(360, 2, { hasHome: true, hasRefresh: true })).toBe(2)
    expect(getInitialVisibleAiTabs(360, 3, { hasHome: true, hasRefresh: true })).toBe(1)
  })
})

describe('getDesiredAiTabWidth', () => {
  it('caps a long truncated label at the pill max width', () => {
    expect(getDesiredAiTabWidth(200, 800)).toBe(AI_TAB_MAX_WIDTH)
  })

  it('keeps a short label at its rendered width', () => {
    expect(getDesiredAiTabWidth(150, 0)).toBe(150)
  })
})

describe('resolveVisibleAiTabCount', () => {
  it('drops a slot when the measured pills no longer fit', () => {
    expect(
      resolveVisibleAiTabCount({
        current: 3,
        tabWidths: [200, 200, 200],
        availableWidth: 300,
        hasOverflow: true
      })
    ).toBe(2)
  })

  it('never drops below zero', () => {
    expect(
      resolveVisibleAiTabCount({
        current: 0,
        tabWidths: [],
        availableWidth: 0,
        hasOverflow: true
      })
    ).toBe(0)
  })

  it('recovers a slot from overflow when there is room for a full pill', () => {
    expect(
      resolveVisibleAiTabCount({
        current: 3,
        tabWidths: [100, 100, 100],
        availableWidth: 600,
        hasOverflow: true
      })
    ).toBe(4)
  })

  it('recovers from zero once the row has room', () => {
    expect(
      resolveVisibleAiTabCount({
        current: 0,
        tabWidths: [],
        availableWidth: 400,
        hasOverflow: true
      })
    ).toBe(1)
  })

  it('does not add a slot when the spare space cannot fit a full pill', () => {
    expect(
      resolveVisibleAiTabCount({
        current: 1,
        tabWidths: [AI_TAB_MAX_WIDTH],
        availableWidth: AI_TAB_MAX_WIDTH + 40,
        hasOverflow: true
      })
    ).toBe(1)
  })
})

describe('clamp', () => {
  it.each([
    ['inside the range', 5, 0, 10, 5],
    ['below the range', -3, 0, 10, 0],
    ['above the range', 99, 0, 10, 10],
    ['exactly the min', 0, 0, 10, 0],
    ['exactly the max', 10, 0, 10, 10],
    ['inside a negative range', -5, -10, -1, -5],
    ['above a negative range', 0, -10, -1, -1],
    ['below a negative range', -15, -10, -1, -10],
    ['equal min and max', 5, 3, 3, 3]
  ])('%s', (_case, value, min, max, expected) => {
    expect(clamp(value, min, max)).toBe(expected)
  })
})
