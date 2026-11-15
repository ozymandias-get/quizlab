import { describe, expect, it } from 'vitest'

import { createPdfResponseHeaders, parseByteRange } from '../../../features/pdf/pdfStreamUtils.js'

function stats(overrides: { size?: number; mtimeMs?: number; ctimeMs?: number }) {
  return {
    size: 100,
    mtimeMs: 1_700_000_000_000,
    ctimeMs: 1_700_000_000_001,
    ...overrides
  } as unknown as Parameters<typeof createPdfResponseHeaders>[0]
}

describe('createPdfResponseHeaders', () => {
  it('changes the ETag when a rewrite preserves size and mtime but updates ctime', () => {
    const before = createPdfResponseHeaders(stats({}))
    const after = createPdfResponseHeaders(stats({ ctimeMs: 1_700_000_000_002 }))

    expect(before.ETag).not.toBe(after.ETag)
  })
})

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
