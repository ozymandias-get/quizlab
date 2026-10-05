import { describe, expect, it } from 'vitest'

import {
  boundsEqual,
  isUsableBounds,
  isValidHostToken,
  isValidViewId,
  MAX_VIEW_RECT_EDGE,
  MAX_VIEW_BORDER_RADIUS,
  parseBounds,
  parseDelta,
  parseHostRequest,
  parseHostSyncRequest,
  parseInputEvent,
  parseRestoredUrl,
  parseScript,
  parseSource,
  parseTabRequest,
  parseText
} from '../../../features/ai-view/aiViewContract.js'

describe('view id validation', () => {
  it('accepts a bounded non-empty string', () => {
    expect(isValidViewId('tab-1')).toBe(true)
    expect(isValidViewId('gdrive:pdf_tab-1')).toBe(true)
    expect(isValidViewId('a'.repeat(128))).toBe(true)
  })

  it('rejects empty, oversized and non-string ids', () => {
    expect(isValidViewId('')).toBe(false)
    expect(isValidViewId('a'.repeat(129))).toBe(false)
    expect(isValidViewId(42)).toBe(false)
    expect(isValidViewId(null)).toBe(false)
    for (const id of ['a\u0000b', 'a b', '../tab', 'ai:tab', 'gdrive:', 'gdrive:a:b']) {
      expect(isValidViewId(id)).toBe(false)
      expect(parseTabRequest({ viewId: id })).toBeNull()
    }
  })

  it('rejects path-like host tokens', () => {
    expect(isValidHostToken('host-1')).toBe(true)
    expect(isValidHostToken('../../etc/passwd')).toBe(false)
    expect(isValidHostToken('host\u0000other')).toBe(false)
    expect(isValidHostToken('')).toBe(false)
    expect(isValidHostToken('a'.repeat(129))).toBe(false)
  })
})

describe('parseTabRequest', () => {
  it('accepts a bare view id', () => {
    expect(parseTabRequest({ viewId: 'tab-1', partition: 'evil' })).toEqual({ viewId: 'tab-1' })
  })

  it('refuses to carry a partition through', () => {
    // The renderer has no business naming a partition; anything extra is dropped.
    expect(parseTabRequest({ viewId: 'tab-1', partition: 'persist:ai_custom_x' })).toEqual({
      viewId: 'tab-1'
    })
  })

  it('rejects malformed payloads', () => {
    expect(parseTabRequest(null)).toBeNull()
    expect(parseTabRequest({})).toBeNull()
    expect(parseTabRequest({ viewId: '' })).toBeNull()
    expect(parseTabRequest('tab-1')).toBeNull()
    expect(parseTabRequest([{ viewId: 'tab-1' }])).toBeNull()
  })
})

describe('parseHostSyncRequest', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 200 }

  it('requires an id, a token, a rectangle and a boolean', () => {
    expect(
      parseHostSyncRequest({ viewId: 'tab-1', hostToken: 'h1', bounds, visible: true })
    ).toEqual({
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { ...bounds, borderRadius: 0 },
      visible: true
    })
    expect(
      parseHostSyncRequest({ viewId: 'tab-1', hostToken: 'h1', bounds, visible: 'yes' })
    ).toBeNull()
    expect(parseHostSyncRequest({ viewId: 'tab-1', hostToken: 'h1', visible: true })).toBeNull()
    expect(parseHostSyncRequest({ viewId: 'tab-1', bounds, visible: true })).toBeNull()
  })

  it('normalises the rectangle', () => {
    const parsed = parseHostSyncRequest({
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: -5, y: 2.4, width: 10.6, height: 20.2 },
      visible: false
    })
    expect(parsed?.bounds).toEqual({ x: 0, y: 2, width: 11, height: 20, borderRadius: 0 })
  })

  it('clamps absurd coordinates instead of rejecting them', () => {
    const parsed = parseHostSyncRequest({
      viewId: 'tab-1',
      hostToken: 'h1',
      bounds: { x: 1e9, y: -1e9, width: 1e9, height: 1e9 },
      visible: true
    })
    expect(parsed?.bounds).toEqual({
      x: MAX_VIEW_RECT_EDGE,
      y: 0,
      width: MAX_VIEW_RECT_EDGE,
      height: MAX_VIEW_RECT_EDGE,
      borderRadius: 0
    })
  })
})

describe('parseBounds', () => {
  it('rounds to integers and floors negatives at zero', () => {
    expect(parseBounds({ x: -3, y: 1.5, width: 2.4, height: 3.5 })).toEqual({
      x: 0,
      y: 2,
      width: 2,
      height: 4,
      borderRadius: 0
    })
  })

  it('accepts a collapsed rectangle but marks it unusable', () => {
    const zero = parseBounds({ x: 0, y: 0, width: 0, height: 0 })
    expect(zero).toEqual({ x: 0, y: 0, width: 0, height: 0, borderRadius: 0 })
    expect(isUsableBounds(zero)).toBe(false)
  })

  it('keeps a sub-pixel radius and clamps a hostile one', () => {
    expect(parseBounds({ x: 0, y: 0, width: 1, height: 1, borderRadius: 15.5 })?.borderRadius).toBe(
      15.5
    )
    expect(parseBounds({ x: 0, y: 0, width: 1, height: 1, borderRadius: -8 })?.borderRadius).toBe(0)
    expect(
      parseBounds({ x: 0, y: 0, width: 1, height: 1, borderRadius: 99_999 })?.borderRadius
    ).toBe(MAX_VIEW_BORDER_RADIUS)
    // A renderer that sends junk must not be able to break the geometry.
    expect(
      parseBounds({ x: 0, y: 0, width: 1, height: 1, borderRadius: 'nope' })?.borderRadius
    ).toBe(0)
    expect(parseBounds({ x: 0, y: 0, width: 1, height: 1, borderRadius: NaN })?.borderRadius).toBe(
      0
    )
  })

  it('rejects non-finite and non-numeric values', () => {
    expect(parseBounds({ x: NaN, y: 0, width: 1, height: 1 })).toBeNull()
    expect(parseBounds({ x: Infinity, y: 0, width: 1, height: 1 })).toBeNull()
    expect(parseBounds({ x: '0', y: 0, width: 1, height: 1 })).toBeNull()
    expect(parseBounds(null)).toBeNull()
  })

  it('compares rectangles structurally, radius included', () => {
    expect(
      boundsEqual({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 })
    ).toBe(true)
    expect(
      boundsEqual({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 5 })
    ).toBe(false)
    // An absent radius means square, so it must match an explicit zero.
    expect(
      boundsEqual(
        { x: 1, y: 2, width: 3, height: 4 },
        { x: 1, y: 2, width: 3, height: 4, borderRadius: 0 }
      )
    ).toBe(true)
    // A radius change alone is a real change: the view must be re-clipped.
    expect(
      boundsEqual(
        { x: 1, y: 2, width: 3, height: 4, borderRadius: 0 },
        { x: 1, y: 2, width: 3, height: 4, borderRadius: 16 }
      )
    ).toBe(false)
    expect(boundsEqual(null, null)).toBe(true)
    expect(boundsEqual(null, { x: 0, y: 0, width: 0, height: 0 })).toBe(false)
  })
})

describe('parseSource', () => {
  it('accepts only the two closed-union targets', () => {
    expect(parseSource({ kind: 'ai-platform', modelId: 'chatgpt' })).toEqual({
      kind: 'ai-platform',
      modelId: 'chatgpt'
    })
    expect(parseSource({ kind: 'google-web-app', appId: 'gdrive' })).toEqual({
      kind: 'google-web-app',
      appId: 'gdrive'
    })
  })

  it('refuses a renderer-supplied partition or url', () => {
    expect(
      parseSource({ kind: 'ai-platform', modelId: 'chatgpt', partition: 'persist:evil' })
    ).toEqual({ kind: 'ai-platform', modelId: 'chatgpt' })
    expect(
      parseSource({ kind: 'ai-platform', modelId: 'chatgpt', url: 'https://evil.test' })
    ).toEqual({
      kind: 'ai-platform',
      modelId: 'chatgpt'
    })
  })

  it('rejects unknown kinds', () => {
    expect(parseSource({ kind: 'anything-else', modelId: 'x' })).toBeNull()
    expect(parseSource({ kind: 'ai-platform' })).toBeNull()
    expect(parseSource(null)).toBeNull()
  })
})

describe('parseScript / parseText / parseRestoredUrl', () => {
  it('bounds script size and rejects empty scripts', () => {
    expect(parseScript('document.readyState')).toBe('document.readyState')
    expect(parseScript('')).toBeNull()
    expect(parseScript('a'.repeat(512 * 1024 + 1))).toBeNull()
    expect(parseScript(123)).toBeNull()
  })

  it('allows empty text but bounds its size', () => {
    expect(parseText('')).toBe('')
    expect(parseText('hello')).toBe('hello')
    expect(parseText('a'.repeat(512 * 1024 + 1))).toBeNull()
  })

  it('accepts only https urls', () => {
    expect(parseRestoredUrl('https://chatgpt.com/c/abc')).toBe('https://chatgpt.com/c/abc')
    expect(parseRestoredUrl('http://chatgpt.com')).toBeNull()
    expect(parseRestoredUrl('file:///etc/passwd')).toBeNull()
    expect(parseRestoredUrl('javascript:alert(1)')).toBeNull()
    expect(parseRestoredUrl('')).toBeNull()
    expect(parseRestoredUrl('a'.repeat(4097))).toBeNull()
  })
})

describe('parseInputEvent', () => {
  it('accepts the keyboard event types with a key code', () => {
    expect(parseInputEvent({ type: 'keyDown', keyCode: 'v', modifiers: ['control'] })).toEqual({
      type: 'keyDown',
      keyCode: 'v',
      modifiers: ['control']
    })
    expect(parseInputEvent({ type: 'char', keyCode: 'v' })).toEqual({ type: 'char', keyCode: 'v' })
  })

  it('drops non-string modifiers instead of trusting them', () => {
    expect(parseInputEvent({ type: 'keyUp', keyCode: 'v', modifiers: [1, 'control'] })).toEqual({
      type: 'keyUp',
      keyCode: 'v',
      modifiers: ['control']
    })
  })

  it('rejects mouse events and oversized key codes', () => {
    expect(parseInputEvent({ type: 'mouseDown', keyCode: 'v' })).toBeNull()
    expect(parseInputEvent({ type: 'keyDown', keyCode: '' })).toBeNull()
    expect(parseInputEvent({ type: 'keyDown', keyCode: 'a'.repeat(65) })).toBeNull()
    expect(parseInputEvent(null)).toBeNull()
  })

  it('caps the modifier list', () => {
    const modifiers = Array.from({ length: 50 }, () => 'control')
    expect(parseInputEvent({ type: 'keyDown', keyCode: 'v', modifiers })?.modifiers).toHaveLength(8)
  })
})

describe('parseDelta', () => {
  it('only accepts a single step in history', () => {
    expect(parseDelta(-1)).toBe(-1)
    expect(parseDelta(1)).toBe(1)
    expect(parseDelta(0)).toBeNull()
    expect(parseDelta(2)).toBeNull()
    expect(parseDelta('1')).toBeNull()
  })
})

describe('parseHostRequest', () => {
  it('needs both a view id and a host token', () => {
    expect(parseHostRequest({ viewId: 't', hostToken: 'h' })).toEqual({
      viewId: 't',
      hostToken: 'h'
    })
    expect(parseHostRequest({ viewId: 't' })).toBeNull()
    expect(parseHostRequest({ hostToken: 'h' })).toBeNull()
  })
})
