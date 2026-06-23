import { clamp, getVisibleTabIds } from '@features/ai/ui/aiTabStrip/aiTabStripUtils'

import type { Tab } from '@app/providers/AiContext'
import { isValidHexColor } from '@shared/lib/uiUtils'

import { describe, expect, it } from 'vitest'

const makeTabs = (count: number): Tab[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `tab-${i}`,
    modelId: 'chatgpt',
    title: `Tab ${i}`,
    isPinned: false
  }))

describe('aiTabStrip/utils', () => {
  describe('getVisibleTabIds', () => {
    it('returns all tab ids when there are at most 3 tabs', () => {
      const tabs = makeTabs(3)
      const visible = getVisibleTabIds(tabs, 'tab-0')
      expect(visible).toEqual(new Set(['tab-0', 'tab-1', 'tab-2']))
    })

    it('returns an empty set when there are no tabs', () => {
      expect(getVisibleTabIds([], 'tab-0')).toEqual(new Set())
    })

    it('treats undefined tabs as an empty list', () => {
      expect(getVisibleTabIds(undefined, 'tab-0')).toEqual(new Set())
    })

    it('returns the first 3 tabs when the active tab is at the start', () => {
      const tabs = makeTabs(6)
      const visible = getVisibleTabIds(tabs, 'tab-0')
      expect(visible).toEqual(new Set(['tab-0', 'tab-1', 'tab-2']))
    })

    it('returns the last 3 tabs when the active tab is at the end', () => {
      const tabs = makeTabs(6)
      const visible = getVisibleTabIds(tabs, 'tab-5')
      expect(visible).toEqual(new Set(['tab-3', 'tab-4', 'tab-5']))
    })

    it('returns the active tab and its immediate neighbors in the middle', () => {
      const tabs = makeTabs(6)
      const visible = getVisibleTabIds(tabs, 'tab-3')
      expect(visible).toEqual(new Set(['tab-2', 'tab-3', 'tab-4']))
    })
  })

  describe('clamp', () => {
    it('returns the value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })
    it('returns the min when below range', () => {
      expect(clamp(-3, 0, 10)).toBe(0)
    })
    it('returns the max when above range', () => {
      expect(clamp(99, 0, 10)).toBe(10)
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
})
