/**
 * Tests for src/features/tutorial/lib/placement.ts
 *
 * Pure logic for tooltip placement calculation.
 */
import { calculatePlacement } from '@features/tutorial/lib/placement'

import { beforeEach, describe, expect, it } from 'vitest'

// Helper: create a mock DOMRect.
// DOMRect.bottom and DOMRect.right are computed getters (top + height, left + width)
// so we compute them when not explicitly provided.
function rect(opts: Partial<DOMRect>): DOMRect {
  const base = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => {}
  }
  const merged = { ...base, ...opts }
  // Compute bottom/right from top/left + height/width if not explicitly overridden
  if (opts.bottom === undefined && opts.top !== undefined && opts.height !== undefined) {
    merged.bottom = merged.top + merged.height
  }
  if (opts.right === undefined && opts.left !== undefined && opts.width !== undefined) {
    merged.right = merged.left + merged.width
  }
  return merged
}

describe('calculatePlacement', () => {
  beforeEach(() => {
    window.innerWidth = 1024
    window.innerHeight = 768
  })

  describe('with null target', () => {
    it('centers on screen', () => {
      const pos = calculatePlacement(null, 'top')
      expect(pos.left).toBe((1024 - 440) / 2) // (1024-440)/2 = 292
      expect(pos.top).toBe((768 - 200) / 2) // (768-200)/2 = 284
    })

    it('centers regardless of placement value when target is null', () => {
      const pos = calculatePlacement(null, 'bottom')
      expect(pos.left).toBe(292)
      expect(pos.top).toBe(284)
    })
  })

  describe('placement "center"', () => {
    it('ignores target rect and centers on screen', () => {
      const target = rect({ top: 100, left: 100, width: 100, height: 100 })
      const pos = calculatePlacement(target, 'center')
      expect(pos.left).toBe(292)
      expect(pos.top).toBe(284)
    })
  })

  describe('placement "top"', () => {
    it('places above the target', () => {
      const target = rect({ top: 400, left: 400, width: 200, height: 50 })
      const pos = calculatePlacement(target, 'top')
      expect(pos.top).toBe(400 - 200 - 16) // top - height - padding = 184
      expect(pos.left).toBe(400 + 100 - 220) // centerX - 440/2 = 280
    })

    it('clamps when tooltip would overflow top', () => {
      const target = rect({ top: 10, left: 100, width: 100, height: 50 })
      const pos = calculatePlacement(target, 'top')
      // top would be 10-200-16 = -206, clamped to padding=16
      expect(pos.top).toBe(16)
    })
  })

  describe('placement "bottom"', () => {
    it('places below the target', () => {
      const target = rect({ top: 100, left: 400, width: 200, height: 50 })
      const pos = calculatePlacement(target, 'bottom')
      expect(pos.top).toBe(100 + 50 + 16) // bottom + padding = 166
    })

    it('clamps when tooltip would overflow bottom', () => {
      window.innerHeight = 300
      const target = rect({ top: 250, left: 100, width: 100, height: 50 })
      const pos = calculatePlacement(target, 'bottom')
      // bottom+padding = 250+50+16 = 316, clamped to 300-200-16 = 84
      expect(pos.top).toBe(300 - 200 - 16) // vh - height - padding = 84
    })
  })

  describe('placement "left"', () => {
    it('places to the left of the target', () => {
      const target = rect({ top: 200, left: 500, width: 100, height: 100 })
      const pos = calculatePlacement(target, 'left')
      expect(pos.left).toBe(500 - 440 - 16) // left - width - padding = 44
    })

    it('clamps when tooltip would overflow left', () => {
      const target = rect({ top: 200, left: 10, width: 50, height: 100 })
      const pos = calculatePlacement(target, 'left')
      expect(pos.left).toBe(16) // clamped to padding
    })
  })

  describe('placement "right"', () => {
    it('places to the right of the target', () => {
      const target = rect({ top: 200, left: 100, width: 100, height: 100 })
      const pos = calculatePlacement(target, 'right')
      expect(pos.left).toBe(100 + 100 + 16) // right + padding = 216
    })

    it('clamps when tooltip would overflow right', () => {
      const target = rect({ top: 200, left: 900, width: 100, height: 100 })
      const pos = calculatePlacement(target, 'right')
      expect(pos.left).toBe(1024 - 440 - 16) // vw - width - padding = 568
    })
  })

  describe('placement "auto"', () => {
    it('places above when there is enough space above', () => {
      const target = rect({ top: 400, left: 400, width: 200, height: 50 })
      const pos = calculatePlacement(target, 'auto')
      expect(pos.top).toBe(400 - 200 - 16) // placed above
    })

    it('places below when space above is insufficient', () => {
      const target = rect({ top: 50, left: 400, width: 200, height: 50 })
      const pos = calculatePlacement(target, 'auto')
      expect(pos.top).toBe(50 + 50 + 16) // placed below
    })

    it('places to the right when no vertical space', () => {
      window.innerHeight = 200
      const target = rect({ top: 10, left: 400, width: 100, height: 180 })
      const pos = calculatePlacement(target, 'auto')
      // spaceAbove = 10 (< 200+16), spaceBelow = 200-190 = 10 (< 200+16)
      // spaceRight = 1024-500 = 524 (>= 440+16)
      expect(pos.left).toBe(400 + 100 + 16) // placed right
    })

    it('places to the left when no vertical or right space', () => {
      window.innerHeight = 200
      const target = rect({ top: 10, left: 900, width: 100, height: 180 })
      const pos = calculatePlacement(target, 'auto')
      // spaceLeft = 900 (>= 440+16)
      expect(pos.left).toBe(900 - 440 - 16) // placed left
    })

    it('centers when no space on any side', () => {
      window.innerWidth = 500
      window.innerHeight = 300
      const target = rect({ top: 10, left: 10, width: 480, height: 280 })
      const pos = calculatePlacement(target, 'auto')
      // Falls through to center fallback
      expect(pos.left).toBeGreaterThanOrEqual(0)
      expect(pos.top).toBeGreaterThanOrEqual(0)
    })
  })

  describe('default placement', () => {
    it('treats unknown placements as top', () => {
      const target = rect({ top: 400, left: 400, width: 200, height: 50 })
      const pos = calculatePlacement(target, 'unknown' as any)
      expect(pos.top).toBe(400 - 200 - 16) // same as top
    })
  })

  describe('custom tooltip size', () => {
    it('uses custom dimensions', () => {
      const target = rect({ top: 400, left: 400, width: 200, height: 50 })
      const pos = calculatePlacement(target, 'top', { width: 300, height: 100 })
      expect(pos.top).toBe(400 - 100 - 16) // 284
      expect(pos.left).toBe(500 - 150) // centerX - 300/2 = 350
    })
  })

  describe('custom viewport padding', () => {
    it('uses custom padding', () => {
      const target = rect({ top: 400, left: 400, width: 200, height: 50 })
      const pos = calculatePlacement(target, 'top', undefined, 32)
      expect(pos.top).toBe(400 - 200 - 32)
    })
  })
})
