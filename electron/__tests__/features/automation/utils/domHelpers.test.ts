import { beforeEach, describe, expect, it } from 'vitest'
import {
  generateLocatorBundle,
  generateRobustSelector,
  getElementInfo,
  inferSendLikeControl
} from '@electron/features/automation/utils/domHelpers'

describe('domHelpers', () => {
  describe('getElementInfo', () => {
    it('classifies common composer controls', () => {
      const textInput = document.createElement('input')
      textInput.type = 'text'
      const textarea = document.createElement('textarea')
      const button = document.createElement('button')
      const contentEditable = document.createElement('div')
      contentEditable.setAttribute('contenteditable', 'true')

      expect(getElementInfo(textInput as any).category).toBe('input')
      expect(getElementInfo(textarea as any).category).toBe('input')
      expect(getElementInfo(button as any).category).toBe('button')
      expect(getElementInfo(contentEditable as any).category).toBe('input')
    })

    it('keeps low-confidence elements out of the good path', () => {
      const icon = document.createElement('svg')
      const container = document.createElement('div')
      const infoIcon = getElementInfo(icon as any)
      const infoContainer = getElementInfo(container as any)

      expect(infoIcon.confidence).toBe('low')
      expect(infoContainer.category).toBe('container')
    })

    it('classifies Gemini-style send controls that are not native <button>', () => {
      const sendDiv = document.createElement('div')
      sendDiv.setAttribute('aria-label', 'Send message')
      expect(inferSendLikeControl(sendDiv)).toBe(true)
      expect(getElementInfo(sendDiv as any).category).toBe('button')
      expect(getElementInfo(sendDiv as any).confidence).toBe('high')

      const tr = document.createElement('div')
      tr.setAttribute('aria-label', 'Gönder')
      expect(inferSendLikeControl(tr)).toBe(true)
      expect(getElementInfo(tr as any).category).toBe('button')
    })
  })

  describe('generateLocatorBundle', () => {
    beforeEach(() => {
      document.body.innerHTML = ''
    })

    it('prefers stable css candidates for light DOM inputs', () => {
      const input = document.createElement('textarea')
      input.setAttribute('data-testid', 'composer-input')
      input.setAttribute('aria-label', 'Ask anything')
      document.body.appendChild(input)

      const bundle = generateLocatorBundle(input, 'input')

      expect(bundle?.primarySelector).toBe('textarea[data-testid="composer-input"]')
      expect(bundle?.candidates).toContain('[data-testid="composer-input"]')
      expect(bundle?.fingerprint.dataTestId).toBe('composer-input')
      expect(bundle?.fingerprint.ariaLabel).toBe('Ask anything')
      expect(bundle?.fingerprint.hostChain).toEqual([])
    })

    it('captures shadow host chain instead of document body fallback', () => {
      const host = document.createElement('rich-textarea')
      host.id = 'composer-host'
      const shadowRoot = host.attachShadow({ mode: 'open' })
      const input = document.createElement('div')
      input.setAttribute('role', 'textbox')
      input.setAttribute('contenteditable', 'true')
      shadowRoot.appendChild(input)
      document.body.appendChild(host)

      const bundle = generateLocatorBundle(input, 'input')

      expect(bundle?.primarySelector).toBe('div[role="textbox"]')
      expect(bundle?.fingerprint.hostChain).toEqual([
        expect.objectContaining({
          selector: '#composer-host',
          tag: 'rich-textarea'
        })
      ])
      expect(bundle?.fingerprint.localPath).toEqual(['div'])
    })

    it('stores button text in the fingerprint for ambiguous layouts', () => {
      const button = document.createElement('button')
      button.textContent = 'Send now'
      document.body.appendChild(button)

      const bundle = generateLocatorBundle(button, 'button')

      expect(bundle?.fingerprint.text).toBe('Send now')
      expect(bundle?.candidates).toEqual([])
    })
  })

  describe('generateRobustSelector', () => {
    beforeEach(() => {
      document.body.innerHTML = ''
    })

    it('returns null for missing elements', () => {
      expect(generateRobustSelector(null)).toBeNull()
    })

    it('keeps stable ids and rejects generated ids', () => {
      const stable = document.createElement('div')
      stable.id = 'composer'
      const unstable = document.createElement('div')
      unstable.id = '123456789012345'
      document.body.append(stable, unstable)

      expect(generateRobustSelector(stable)).toBe('#composer')
      expect(generateRobustSelector(unstable)).not.toBe('#123456789012345')
    })
  })
})
