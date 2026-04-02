import { describe, it, expect } from 'vitest'
import { hexToRgba } from '@shared/lib/uiUtils'

describe('uiUtils', () => {
  describe('hexToRgba', () => {
    it('converts 6-digit hex to rgba', () => {
      expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
      expect(hexToRgba('00ff00', 1)).toBe('rgba(0, 255, 0, 1)')
    })

    it('converts 3-digit hex to rgba', () => {
      expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)')
    })

    it('handles default alpha', () => {
      expect(hexToRgba('#0000ff')).toBe('rgba(0, 0, 255, 1)')
    })

    it('handles empty input', () => {
      expect(hexToRgba('')).toBe('rgba(0, 0, 0, 1)')
    })
  })
})
