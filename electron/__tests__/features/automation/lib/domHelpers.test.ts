import type { PickerElement } from '@electron/features/automation/lib/dom/pickerTypes'

import {
  escapeCssStringValue,
  generateLocatorBundle,
  getElementInfo,
  inferSendLikeControl,
  isElementContentEditable
} from '@electron/features/automation/lib/dom/pickerDomRuntime'

import { describe, expect, it } from 'vitest'

describe('escapeCssStringValue', () => {
  it('returns empty string for falsy values', () => {
    expect(escapeCssStringValue('')).toBe('')
    expect(escapeCssStringValue(null as never)).toBe('')
    expect(escapeCssStringValue(undefined as never)).toBe('')
  })

  it('escapes backslashes', () => {
    expect(escapeCssStringValue('a\\b')).toBe('a\\\\b')
  })

  it('escapes double quotes', () => {
    expect(escapeCssStringValue('a"b')).toBe('a\\"b')
  })

  it('escapes both backslashes and double quotes', () => {
    expect(escapeCssStringValue('\\"hello\\"')).toBe('\\\\\\"hello\\\\\\"')
  })

  it('returns the same string when no escaping is needed', () => {
    expect(escapeCssStringValue('hello-world')).toBe('hello-world')
  })
})

describe('isElementContentEditable', () => {
  it('returns true for HTMLElement with contenteditable attribute', () => {
    const el = document.createElement('div')
    el.setAttribute('contenteditable', 'true')
    expect(isElementContentEditable(el)).toBe(true)
  })

  it('returns false for HTMLElement without contentEditable', () => {
    const el = document.createElement('div')
    expect(isElementContentEditable(el)).toBe(false)
  })

  it('returns true when contenteditable attribute is "true"', () => {
    const el = document.createElement('div')
    el.setAttribute('contenteditable', 'true')
    expect(isElementContentEditable(el)).toBe(true)
  })

  it('returns false for non-HTMLElements without isContentEditable', () => {
    const el = document.createElement('div') as unknown as SVGElement
    expect(isElementContentEditable(el as unknown as Element)).toBe(false)
  })
})

describe('inferSendLikeControl', () => {
  it('returns true when aria-label contains "send"', () => {
    const el = document.createElement('button')
    el.setAttribute('aria-label', 'Send message')
    expect(inferSendLikeControl(el)).toBe(true)
  })

  it('returns true when data-testid contains "send"', () => {
    const el = document.createElement('button')
    el.setAttribute('data-testid', 'send-button')
    expect(inferSendLikeControl(el)).toBe(true)
  })

  it('returns true when className contains "send"', () => {
    const el = document.createElement('button')
    el.className = 'send-message-btn'
    expect(inferSendLikeControl(el)).toBe(true)
  })

  it('returns false for a generic element', () => {
    const el = document.createElement('div')
    expect(inferSendLikeControl(el)).toBe(false)
  })
})

describe('getElementInfo', () => {
  it('returns high-confidence button info for a send-like control', () => {
    const el = document.createElement('button')
    el.setAttribute('aria-label', 'Send')
    const info = getElementInfo(el as unknown as PickerElement)
    expect(info.category).toBe('button')
    expect(info.confidence).toBe('high')
    expect(info.labelEN).toBe('Send Button')
  })

  it('returns input info for input[type="text"]', () => {
    const el = document.createElement('input')
    el.setAttribute('type', 'text')
    const info = getElementInfo(el as unknown as PickerElement)
    expect(info.category).toBe('input')
    expect(info.confidence).toBe('high')
  })

  it('returns button info for a <button> element', () => {
    const el = document.createElement('button')
    const info = getElementInfo(el as unknown as PickerElement)
    expect(info.category).toBe('button')
    expect(info.confidence).toBe('high')
  })

  it('returns text info for a <span> element', () => {
    const el = document.createElement('span')
    const info = getElementInfo(el as unknown as PickerElement)
    expect(info.category).toBe('text')
    expect(info.confidence).toBe('low')
  })
})

describe('generateLocatorBundle', () => {
  it('returns null for null element', () => {
    expect(generateLocatorBundle(null, 'input')).toBeNull()
  })

  it('generates a locator bundle for an input element', () => {
    const el = document.createElement('input')
    el.setAttribute('type', 'text')
    el.setAttribute('placeholder', 'Type here')
    const bundle = generateLocatorBundle(el, 'input')
    expect(bundle).not.toBeNull()
    expect(bundle!.candidates.length).toBeGreaterThan(0)
    expect(bundle!.fingerprint.tag).toBe('input')
  })

  it('includes contentEditable in fingerprint for contenteditable elements', () => {
    const el = document.createElement('div')
    el.setAttribute('contenteditable', 'true')
    const bundle = generateLocatorBundle(el, 'input')
    expect(bundle!.fingerprint.contentEditable).toBe(true)
  })
})
