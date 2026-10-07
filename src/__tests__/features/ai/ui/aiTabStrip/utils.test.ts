import { clamp, getVisibleTabIds } from '@features/ai/ui/aiTabStrip/aiTabStripUtils'
import { isValidHexColor } from '@shared/lib/uiUtils'

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

describe('isValidHexColor', () => {
  it.each([
    ['#fff', true],
    ['#FFFFFF', true],
    ['#abcdef', true],
    ['#ABCDEF12', false],
    ['rgb(0,0,0)', false],
    ['white', false],
    ['', false]
  ])('returns %s for %s', (input, expected) => {
    expect(isValidHexColor(input)).toBe(expected)
  })
})
