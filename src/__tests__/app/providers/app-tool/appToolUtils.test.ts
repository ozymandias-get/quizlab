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
  it('returns a string starting with the prefix', () => {
    expect(buildPendingId('text').startsWith('text_')).toBe(true)
    expect(buildPendingId('image').startsWith('image_')).toBe(true)
  })

  it('includes a numeric timestamp after the prefix', () => {
    const id = buildPendingId('text')
    const match = id.match(/^text_(\d+)_/)
    expect(match).not.toBeNull()
    // Timestamp should be a recent number (within last 5s)
    const ts = parseInt(match![1], 10)
    expect(ts).toBeGreaterThan(Date.now() - 5_000)
    expect(ts).toBeLessThanOrEqual(Date.now())
  })

  it('includes a random suffix after the timestamp', () => {
    const id = buildPendingId('text')
    const parts = id.split('_')
    expect(parts.length).toBe(3)
    expect(parts[2].length).toBeGreaterThan(0)
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

  it('respects the prefix type', () => {
    expect(buildPendingId('text').startsWith('text_')).toBe(true)
    expect(buildPendingId('image').startsWith('image_')).toBe(true)
    // No other prefixes
    expect(buildPendingId('text')).not.toMatch(/^image_/)
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

  it('is a no-op when window.getSelection is undefined', () => {
    // Mock the function to return undefined
    const originalGetSelection = window.getSelection
    ;(window as any).getSelection = undefined
    try {
      // Should not throw
      clearBrowserTextSelection()
    } finally {
      ;(window as any).getSelection = originalGetSelection
    }
  })

  it('is a no-op when getSelection returns null', () => {
    const originalGetSelection = window.getSelection
    ;(window as any).getSelection = () => null
    try {
      clearBrowserTextSelection() // should not throw
    } finally {
      ;(window as any).getSelection = originalGetSelection
    }
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
