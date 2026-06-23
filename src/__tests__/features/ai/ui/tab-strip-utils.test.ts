/**
 * Tests for the AI tab strip utilities (clamp, getVisibleTabIds).
 * These are pure functions used by the tab strip UI for windowing
 * logic (only show 3 tabs at a time for long lists).
 */
import { describe, expect, it } from 'vitest'

import type { Tab } from '../../../../app/providers/AiContext'
import { clamp, getVisibleTabIds } from '../../../../features/ai/ui/aiTabStrip/utils'

function makeTabs(count: number): Tab[] {
  return Array.from(
    { length: count },
    (_, i) =>
      ({
        id: `tab-${i}`,
        modelId: `model-${i}`
      }) as Tab
  )
}

describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(0, -10, -1)).toBe(-1)
    expect(clamp(-15, -10, -1)).toBe(-10)
  })

  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3)
  })
})

describe('getVisibleTabIds - small lists (≤ 3 tabs)', () => {
  it('returns all tab ids for an empty list', () => {
    const result = getVisibleTabIds([], 'tab-0')
    expect(result.size).toBe(0)
  })

  it('returns all tab ids for a single tab', () => {
    const tabs = makeTabs(1)
    const result = getVisibleTabIds(tabs, 'tab-0')
    expect(result.size).toBe(1)
    expect(result.has('tab-0')).toBe(true)
  })

  it('returns all tab ids for 2 tabs', () => {
    const tabs = makeTabs(2)
    const result = getVisibleTabIds(tabs, 'tab-0')
    expect(result.size).toBe(2)
    expect(result.has('tab-0')).toBe(true)
    expect(result.has('tab-1')).toBe(true)
  })

  it('returns all tab ids for 3 tabs', () => {
    const tabs = makeTabs(3)
    const result = getVisibleTabIds(tabs, 'tab-1')
    expect(result.size).toBe(3)
  })

  it('handles undefined tabs as empty list', () => {
    const result = getVisibleTabIds(undefined, 'tab-0')
    expect(result.size).toBe(0)
  })
})

describe('getVisibleTabIds - large lists (> 3 tabs)', () => {
  it('returns first 3 tabs when active is at the start', () => {
    const tabs = makeTabs(10)
    const result = getVisibleTabIds(tabs, 'tab-0')
    expect([...result].sort()).toEqual(['tab-0', 'tab-1', 'tab-2'])
  })

  it('returns last 3 tabs when active is at the end', () => {
    const tabs = makeTabs(10)
    const result = getVisibleTabIds(tabs, 'tab-9')
    expect([...result].sort()).toEqual(['tab-7', 'tab-8', 'tab-9'])
  })

  it('returns active + immediate neighbors when in the middle', () => {
    const tabs = makeTabs(10)
    const result = getVisibleTabIds(tabs, 'tab-5')
    expect([...result].sort()).toEqual(['tab-4', 'tab-5', 'tab-6'])
  })

  it('returns 3 tabs at the start when active is at index 1', () => {
    const tabs = makeTabs(10)
    const result = getVisibleTabIds(tabs, 'tab-1')
    // activeIndex > 0, so we get [active-1, active, active+1]
    expect([...result].sort()).toEqual(['tab-0', 'tab-1', 'tab-2'])
  })

  it('returns 3 tabs at the end when active is at second-to-last', () => {
    const tabs = makeTabs(10)
    const result = getVisibleTabIds(tabs, 'tab-8')
    expect([...result].sort()).toEqual(['tab-7', 'tab-8', 'tab-9'])
  })

  it('returns 3 tabs for a 4-tab list when active is in the middle', () => {
    const tabs = makeTabs(4)
    const result = getVisibleTabIds(tabs, 'tab-2')
    expect([...result].sort()).toEqual(['tab-1', 'tab-2', 'tab-3'])
  })

  it('returns active + neighbors when active id is not found', () => {
    const tabs = makeTabs(10)
    // activeTabId not in list — findIndex returns -1, treated as "≤ 0"
    const result = getVisibleTabIds(tabs, 'unknown')
    expect([...result].sort()).toEqual(['tab-0', 'tab-1', 'tab-2'])
  })
})
