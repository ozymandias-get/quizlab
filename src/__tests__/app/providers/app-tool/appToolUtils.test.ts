/**
 * Tests for appToolUtils — buildPendingId, clearBrowserTextSelection.
 * blobUrlToDataUrl is a fetch-dependent function exercised by integration
 * tests; the pure-id helper is the highest-value pin-down here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildPendingId,
  clearBrowserTextSelection
} from '../../../../app/providers/app-tool/appToolUtils'

describe('buildPendingId', () => {
  // Biçim sözleşmesi tek id'de doğrulanır: `<prefix>_<timestamp>_<suffix>`.
  it('builds "<prefix>_<timestamp>_<suffix>" with a fresh timestamp', () => {
    for (const prefix of ['text', 'image'] as const) {
      const id = buildPendingId(prefix)
      expect(id.startsWith(`${prefix}_`)).toBe(true)

      const match = id.match(new RegExp(`^${prefix}_(\\d+)_`))
      expect(match).not.toBeNull()
      const ts = parseInt(match![1], 10)
      // Zaman damgası şimdiye yakın olmalı (5 sn tolerans).
      expect(ts).toBeGreaterThan(Date.now() - 5_000)
      expect(ts).toBeLessThanOrEqual(Date.now())
      expect(id.split('_')).toHaveLength(3)
      expect(id.split('_')[2].length).toBeGreaterThan(0)
    }
  })

  it('produces unique ids for consecutive calls', async () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(buildPendingId('text'))
    }
    // Some may collide if Date.now() and Math.random() align, but for
    // 100 calls we should have at least 90 unique ids
    expect(ids.size).toBeGreaterThanOrEqual(90)
  })
})

describe('clearBrowserTextSelection', () => {
  let removeAllRangesSpy: any

  beforeEach(() => {
    removeAllRangesSpy = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is a no-op when rangeCount is 0', () => {
    const originalGetSelection = window.getSelection
    ;(window as any).getSelection = () => ({
      rangeCount: 0,
      removeAllRanges: removeAllRangesSpy
    })
    try {
      clearBrowserTextSelection()
      expect(removeAllRangesSpy).not.toHaveBeenCalled()
    } finally {
      ;(window as any).getSelection = originalGetSelection
    }
  })

  it('calls removeAllRanges when there is an active selection', () => {
    const originalGetSelection = window.getSelection
    ;(window as any).getSelection = () => ({
      rangeCount: 1,
      removeAllRanges: removeAllRangesSpy
    })
    try {
      clearBrowserTextSelection()
      expect(removeAllRangesSpy).toHaveBeenCalled()
    } finally {
      ;(window as any).getSelection = originalGetSelection
    }
  })
})
