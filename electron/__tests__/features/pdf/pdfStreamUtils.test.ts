import { describe, expect, it } from 'vitest'

import { parseByteRange } from '../../../features/pdf/pdfStreamUtils.js'

describe('parseByteRange', () => {
  it('clamps an end beyond the representation', () => {
    expect(parseByteRange('bytes=900-2000', 1000)).toEqual({ start: 900, end: 999 })
  })

  it('rejects a start beyond the representation', () => {
    expect(parseByteRange('bytes=1000-1001', 1000)).toBeNull()
  })

  it('keeps suffix ranges valid', () => {
    expect(parseByteRange('bytes=-2000', 1000)).toEqual({ start: 0, end: 999 })
  })
})
