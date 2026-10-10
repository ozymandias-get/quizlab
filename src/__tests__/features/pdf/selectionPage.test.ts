import { describe, expect, it } from 'vitest'

import { computeSelectionMenuAnchor } from '../../../features/pdf/text/selectionPage'

describe('computeSelectionMenuAnchor', () => {
  it('places the menu below the selection end by default', () => {
    const anchor = computeSelectionMenuAnchor({ top: 100, bottom: 120, left: 200, right: 300 })
    expect(anchor.top).toBeGreaterThanOrEqual(128)
    expect(anchor.left).toBeGreaterThanOrEqual(0)
  })

  it('flips above when there is no room below', () => {
    const viewportH = window.innerHeight
    const anchor = computeSelectionMenuAnchor({
      top: viewportH - 30,
      bottom: viewportH - 10,
      left: 200,
      right: 300
    })
    expect(anchor.top).toBeLessThan(viewportH - 30)
  })

  it('clamps to the left edge', () => {
    const anchor = computeSelectionMenuAnchor({ top: 100, bottom: 120, left: 0, right: 10 })
    expect(anchor.left).toBeGreaterThanOrEqual(8)
  })

  it('clamps to the right edge', () => {
    const viewportW = window.innerWidth
    const anchor = computeSelectionMenuAnchor({
      top: 100,
      bottom: 120,
      left: viewportW - 10,
      right: viewportW
    })
    expect(anchor.left + 240).toBeLessThanOrEqual(viewportW)
  })

  it('stays inside the PDF container when provided', () => {
    const anchor = computeSelectionMenuAnchor(
      { top: 100, bottom: 120, left: 200, right: 300 },
      { top: 0, bottom: 400, left: 0, right: 500 }
    )
    expect(anchor.top).toBeGreaterThanOrEqual(8)
    expect(anchor.top).toBeLessThanOrEqual(400)
    expect(anchor.left).toBeGreaterThanOrEqual(8)
  })

  it('is deterministic for the same input (no reposition churn)', () => {
    const rect = { top: 150, bottom: 170, left: 250, right: 350 }
    expect(computeSelectionMenuAnchor(rect)).toEqual(computeSelectionMenuAnchor(rect))
  })
})
