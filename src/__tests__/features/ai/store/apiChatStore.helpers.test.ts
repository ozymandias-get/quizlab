import '@shared/i18n/i18next'

import { LOCAL_STORAGE_KEY } from '@features/ai/store/apiChatPersistence'
import {
  buildCombinedPrompt,
  buildErrorReply,
  createEmptySession,
  DEFAULT_SESSION_TITLE,
  generateId,
  getDefaultSessionTitle
} from '@features/ai/store/apiChatSessionUtils'

import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * These helpers were originally re-exported through the deprecated
 * apiChatStore. They now import directly from their source modules.
 *
 * @see apiChatSessionUtils
 * @see apiChatPersistence
 */
describe('apiChatStore helpers (pure functions)', () => {
  beforeAll(async () => {
    await i18next.changeLanguage('tr')
  })

  describe('generateId', () => {
    it('returns a string with the requested prefix', () => {
      const id = generateId('session')
      expect(id.startsWith('session-')).toBe(true)
    })

    it('returns unique ids across consecutive calls', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) ids.add(generateId('msg'))
      // 100 calls with 7-char random suffix should virtually never collide
      expect(ids.size).toBe(100)
    })

    it('uses different prefixes when given', () => {
      const a = generateId('a')
      const b = generateId('b')
      expect(a.startsWith('a-')).toBe(true)
      expect(b.startsWith('b-')).toBe(true)
    })
  })

  describe('createEmptySession', () => {
    it('returns a session with the default title and empty messages', () => {
      const session = createEmptySession()
      expect([DEFAULT_SESSION_TITLE, getDefaultSessionTitle()]).toContain(session.title)
      expect(session.messages).toEqual([])
    })

    it('returns a session with matching createdAt and updatedAt timestamps', () => {
      const before = Date.now()
      const session = createEmptySession()
      const after = Date.now()
      expect(session.createdAt).toBeGreaterThanOrEqual(before)
      expect(session.createdAt).toBeLessThanOrEqual(after)
      expect(session.updatedAt).toBe(session.createdAt)
    })

    it('returns a session with a unique session-prefixed id', () => {
      const a = createEmptySession()
      const b = createEmptySession()
      expect(a.id).not.toBe(b.id)
      expect(a.id.startsWith('session-')).toBe(true)
    })
  })

  describe('buildCombinedPrompt', () => {
    it('returns empty string when no prompt is provided', () => {
      expect(
        buildCombinedPrompt({ memoryPrompt: '', characterPrompt: '', generalPrompt: '' })
      ).toBe('')
    })

    it('joins only the populated parts in the documented order', () => {
      const out = buildCombinedPrompt({
        memoryPrompt: 'user-info',
        characterPrompt: 'char-info',
        generalPrompt: 'sys-info'
      })
      expect(out).toBe(
        ['[User Info]\nuser-info', '[Character]\nchar-info', '[System]\nsys-info'].join('\n\n')
      )
    })

    it('keeps whitespace-only prompts (truthy) and only drops empty strings', () => {
      // Implementation uses `filter(Boolean)` which treats '' as falsy but
      // preserves '   '. This documents the current behavior.
      expect(
        buildCombinedPrompt({ memoryPrompt: '   ', characterPrompt: 'c', generalPrompt: '' })
      ).toBe('[User Info]\n   \n\n[Character]\nc')
    })
  })

  describe('buildErrorReply', () => {
    it('uses the error message when given an Error instance', () => {
      const reply = buildErrorReply(new Error('boom'))
      expect(reply.role).toBe('assistant')
      // locale-aware: tr -> "Hata: boom", en -> "Error: boom"
      expect(reply.content).toMatch(/^(Hata|Error): boom$/)
      expect(reply.id.endsWith('-error')).toBe(true)
    })

    it('falls back to a localized message for non-serializable throws', () => {
      expect(buildErrorReply(undefined).content).toMatch(
        /^(Hata: İstek başarısız oldu|Error: Request failed)$/
      )
      expect(buildErrorReply(() => 'fn').content).toMatch(
        /^(Hata: İstek başarısız oldu|Error: Request failed)$/
      )
    })

    it('passes plain-string and serializable throws through', () => {
      expect(buildErrorReply('bad').content).toMatch(/^(Hata: bad|Error: bad)$/)
      expect(buildErrorReply({ code: 500 }).content).toMatch(
        /^(Hata|Error): \{&?quot;code&?quot;:500\}$/
      )
    })
  })

  describe('constants', () => {
    it('exposes the localStorage key and default title', () => {
      expect(LOCAL_STORAGE_KEY).toBe('quizlab_api_chat_sessions_v2')
      expect(DEFAULT_SESSION_TITLE).toBe('Yeni Sohbet')
    })
  })
})
