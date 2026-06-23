import type { AiSelectorConfig, SelectorHealth, SubmitMode } from '@shared-core/types/automation'

import { describe, expect, it } from 'vitest'

describe('Automation Types - Runtime Validation', () => {
  function isValidSubmitMode(value: unknown): value is SubmitMode {
    return value === 'click' || value === 'enter_key' || value === 'mixed'
  }

  function isValidSelectorHealth(value: unknown): value is SelectorHealth {
    return value === 'ready' || value === 'migrated' || value === 'needs_repick'
  }

  describe('SubmitMode validation', () => {
    it('accepts valid submit modes', () => {
      expect(isValidSubmitMode('click')).toBe(true)
      expect(isValidSubmitMode('enter_key')).toBe(true)
      expect(isValidSubmitMode('mixed')).toBe(true)
    })

    it('rejects invalid submit modes', () => {
      expect(isValidSubmitMode('enter')).toBe(false)
      expect(isValidSubmitMode('auto')).toBe(false)
      expect(isValidSubmitMode('')).toBe(false)
      expect(isValidSubmitMode(null)).toBe(false)
      expect(isValidSubmitMode(undefined)).toBe(false)
      expect(isValidSubmitMode(42)).toBe(false)
    })
  })

  describe('SelectorHealth validation', () => {
    it('accepts valid health states', () => {
      expect(isValidSelectorHealth('ready')).toBe(true)
      expect(isValidSelectorHealth('migrated')).toBe(true)
      expect(isValidSelectorHealth('needs_repick')).toBe(true)
    })

    it('rejects invalid health states', () => {
      expect(isValidSelectorHealth('pending')).toBe(false)
      expect(isValidSelectorHealth('broken')).toBe(false)
      expect(isValidSelectorHealth('')).toBe(false)
      expect(isValidSelectorHealth(null)).toBe(false)
      expect(isValidSelectorHealth(undefined)).toBe(false)
    })
  })

  describe('AiSelectorConfig shape validation', () => {
    it('can create a minimal config', () => {
      const config: AiSelectorConfig = {}
      expect(config).toBeDefined()
    })

    it('can create a full config', () => {
      const config: AiSelectorConfig = {
        version: 2,
        input: 'textarea[data-testid="chat-input"]',
        button: 'button[data-testid="send-button"]',
        waitFor: 'button:not([disabled])',
        submitMode: 'click',
        inputCandidates: ['textarea', 'div[contenteditable]'],
        buttonCandidates: ['button[type="submit"]'],
        health: 'ready',
        sourceUrl: 'https://chat.openai.com',
        sourceHostname: 'chat.openai.com',
        canonicalHostname: 'openai.com'
      }
      expect(config.version).toBe(2)
      expect(config.submitMode).toBe('click')
      expect(config.health).toBe('ready')
    })

    it('config allows custom properties via index signature', () => {
      const config: AiSelectorConfig = {
        customField: 'custom-value',
        anotherField: 42
      }
      expect((config as any).customField).toBe('custom-value')
    })
  })
})
