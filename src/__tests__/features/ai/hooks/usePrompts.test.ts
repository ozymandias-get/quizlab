/**
 * Tests for usePrompts hook — manages default + custom prompts with
 * language filtering and localStorage persistence. Critical for the
 * AI chat feature (users pick a prompt before sending).
 */
import { useLanguage } from '@shared/stores/languageStore'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePrompts } from '../../../../features/ai/hooks/usePrompts'
import { DEFAULT_PROMPTS } from '../../../../shared/constants/prompts'
import { STORAGE_KEYS } from '../../../../shared/constants/storageKeys'

describe('usePrompts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('initial state', () => {
    it('starts with no custom prompts and no selected prompt', () => {
      const { result } = renderHook(() => usePrompts())
      const customPrompts = result.current.allPrompts.filter((p) => !p.isDefault)
      expect(customPrompts).toEqual([])
      expect(result.current.selectedPromptId).toBeNull()
      expect(result.current.activePromptText).toBeNull()
    })

    it('exposes default prompts filtered by the active language', () => {
      const { result } = renderHook(() => usePrompts())
      const currentLang = useLanguage.getState().language
      const expected = DEFAULT_PROMPTS.filter((p) => p.id.endsWith(`_${currentLang}`))
      // Every default prompt in the result should match the current language
      for (const p of result.current.allPrompts.filter((p) => p.isDefault)) {
        expect(p.id).toMatch(new RegExp(`_${currentLang}$`))
      }
      // Should be the same number of prompts (when ignoring custom ones)
      expect(result.current.allPrompts.filter((p) => p.isDefault).length).toBe(expected.length)
    })

    it('marks all default prompts with isDefault: true', () => {
      const { result } = renderHook(() => usePrompts())
      const defaults = result.current.allPrompts.filter((p) => p.isDefault)
      for (const p of defaults) {
        expect(p.isDefault).toBe(true)
      }
    })
  })

  describe('addPrompt', () => {
    it('adds a new custom prompt and selects it', () => {
      const { result } = renderHook(() => usePrompts())

      let added: any
      act(() => {
        added = result.current.addPrompt('My new prompt')
      })

      expect(added).toBeDefined()
      expect(added.text).toBe('My new prompt')
      expect(added.isDefault).toBe(false)
      expect(result.current.selectedPromptId).toBe(added.id)
      expect(result.current.activePromptText).toBe('My new prompt')
    })

    it('trims whitespace from the prompt text', () => {
      const { result } = renderHook(() => usePrompts())

      let added: any
      act(() => {
        added = result.current.addPrompt('  trimmed text  ')
      })

      expect(added.text).toBe('trimmed text')
    })

    it('prepends new prompts to the list (most recent first)', async () => {
      const { result } = renderHook(() => usePrompts())

      act(() => {
        result.current.addPrompt('First')
      })
      const firstId = result.current.selectedPromptId

      // Wait a tick so Date.now() produces a different value
      await new Promise((resolve) => setTimeout(resolve, 5))

      act(() => {
        result.current.addPrompt('Second')
      })

      const customs = result.current.allPrompts.filter((p) => !p.isDefault)
      expect(customs[0].id).not.toBe(firstId)
      expect(customs[0].text).toBe('Second')
    })

    it('persists custom prompts to localStorage', () => {
      const { result } = renderHook(() => usePrompts())

      act(() => {
        result.current.addPrompt('Persisted prompt')
      })

      const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPTS)
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed[0].text).toBe('Persisted prompt')
    })
  })

  describe('deletePrompt', () => {
    it('removes a custom prompt by id', () => {
      const { result } = renderHook(() => usePrompts())

      let added: any
      act(() => {
        added = result.current.addPrompt('To delete')
      })
      expect(result.current.allPrompts.find((p) => p.id === added.id)).toBeDefined()

      act(() => {
        result.current.deletePrompt(added.id)
      })
      expect(result.current.allPrompts.find((p) => p.id === added.id)).toBeUndefined()
    })

    it('clears selection when deleting the selected prompt', () => {
      const { result } = renderHook(() => usePrompts())

      let added: any
      act(() => {
        added = result.current.addPrompt('Selected prompt')
      })
      expect(result.current.selectedPromptId).toBe(added.id)

      act(() => {
        result.current.deletePrompt(added.id)
      })
      expect(result.current.selectedPromptId).toBeNull()
    })

    it('keeps selection when deleting a different prompt', async () => {
      const { result } = renderHook(() => usePrompts())

      let a: any
      act(() => {
        a = result.current.addPrompt('First')
      })
      await new Promise((resolve) => setTimeout(resolve, 5))
      act(() => {
        result.current.addPrompt('Second')
      })
      // Second is now selected (newest)
      const secondId = result.current.selectedPromptId

      act(() => {
        result.current.deletePrompt(a.id)
      })
      expect(result.current.selectedPromptId).toBe(secondId)
    })
  })

  describe('selectPrompt', () => {
    it('selects a prompt by id', async () => {
      const { result } = renderHook(() => usePrompts())

      act(() => {
        result.current.addPrompt('A')
      })
      await new Promise((resolve) => setTimeout(resolve, 5))
      act(() => {
        result.current.addPrompt('B')
      })
      const aId = result.current.allPrompts.find((p) => p.text === 'A')!.id

      act(() => {
        result.current.selectPrompt(aId)
      })
      expect(result.current.selectedPromptId).toBe(aId)
    })

    it('toggles off when re-selecting the already selected prompt', () => {
      const { result } = renderHook(() => usePrompts())

      act(() => {
        result.current.addPrompt('A')
      })
      const aId = result.current.selectedPromptId

      act(() => {
        result.current.selectPrompt(aId!)
      })
      expect(result.current.selectedPromptId).toBeNull()
    })
  })

  describe('clearSelection', () => {
    it('clears the selected prompt', () => {
      const { result } = renderHook(() => usePrompts())

      act(() => {
        result.current.addPrompt('A')
      })
      expect(result.current.selectedPromptId).not.toBeNull()

      act(() => {
        result.current.clearSelection()
      })
      expect(result.current.selectedPromptId).toBeNull()
    })
  })

  describe('activePromptText', () => {
    it('returns null when no prompt is selected', () => {
      const { result } = renderHook(() => usePrompts())
      expect(result.current.activePromptText).toBeNull()
    })

    it('returns the text of the selected prompt', () => {
      const { result } = renderHook(() => usePrompts())
      act(() => {
        result.current.addPrompt('My selected prompt')
      })
      expect(result.current.activePromptText).toBe('My selected prompt')
    })
  })

  describe('persistence', () => {
    it('hydrates custom prompts from localStorage on mount', () => {
      // Pre-populate localStorage BEFORE the hook renders
      const customPrompt = {
        id: 'custom_persisted',
        text: 'Persisted from previous session'
      }
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPTS, JSON.stringify([customPrompt]))

      const { result } = renderHook(() => usePrompts())
      const persisted = result.current.allPrompts.find((p) => p.id === 'custom_persisted')
      expect(persisted).toBeDefined()
      expect(persisted?.text).toBe('Persisted from previous session')
    })

    it('hydrates selected prompt id from localStorage on mount', () => {
      localStorage.setItem(STORAGE_KEYS.SELECTED_PROMPT_ID, 'some-prompt-id')

      const { result } = renderHook(() => usePrompts())
      expect(result.current.selectedPromptId).toBe('some-prompt-id')
    })
  })
})
