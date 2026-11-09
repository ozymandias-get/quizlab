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

  it('rejects a start beyond the safe integer range', () => {
    // 2^53 + 1 loses precision in Number.parseInt; it must not be treated as
    // a valid offset.
    expect(parseByteRange('bytes=9007199254740993-', 1000)).toBeNull()
  })

  it('rejects an end beyond the safe integer range', () => {
    expect(parseByteRange('bytes=0-9007199254740993', 1000)).toBeNull()
  })

  it('rejects a suffix length beyond the safe integer range', () => {
    expect(parseByteRange('bytes=-9007199254740993', 1000)).toBeNull()
  })
})
