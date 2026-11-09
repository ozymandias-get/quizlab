import {
  buildRowLayout,
  LIST_ROW_GAP,
  LIST_ROW_HEIGHT
} from '@features/ai/ui/chat/historyListVirtualization'

import { describe, expect, it } from 'vitest'

const sessions = Array.from({ length: 3 }, (_, i) => ({ id: `s${i}` }))

describe('buildRowLayout', () => {
  it('uses the uniform row height by default', () => {
    const layout = buildRowLayout(sessions, null, LIST_ROW_HEIGHT)
    expect(layout.offsets[1]).toBe(LIST_ROW_HEIGHT + LIST_ROW_GAP)
    expect(layout.totalHeight).toBe(3 * (LIST_ROW_HEIGHT + LIST_ROW_GAP))
  })

  it('uses the measured base height for every normal row', () => {
    const base = LIST_ROW_HEIGHT + 40
    const layout = buildRowLayout(sessions, null, LIST_ROW_HEIGHT, base)
    expect(layout.offsets[1]).toBe(base + LIST_ROW_GAP)
    expect(layout.totalHeight).toBe(3 * (base + LIST_ROW_GAP))
  })

  it('never lets the editing row shrink below the measured base', () => {
    const base = LIST_ROW_HEIGHT + 24
    const layout = buildRowLayout(sessions, 's1', LIST_ROW_HEIGHT, base)
    expect(layout.offsets[2] - layout.offsets[1]).toBe(base + LIST_ROW_GAP)
  })
})
