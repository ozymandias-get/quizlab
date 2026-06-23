import { DEFAULT_PROMPTS, type IPrompt } from '@shared/constants/prompts'
import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage, useLocalStorageString } from '@shared/hooks/useLocalStorage'
import { useLanguage } from '@shared/stores/languageStore'

import { useCallback, useMemo } from 'react'

interface Prompt extends IPrompt {
  isDefault?: boolean
}

interface UsePromptsReturn {
  allPrompts: Prompt[]
  activePromptText: string | null
  selectedPromptId: string | null
  addPrompt: (text: string) => Prompt
  deletePrompt: (id: string) => void
  selectPrompt: (id: string) => void
  clearSelection: () => void
}

/**
 * Hook for managing prompts system
 * Centralizes logic for fetching, adding, deleting and selecting prompts.
 */
export function usePrompts(): UsePromptsReturn {
  const language = useLanguage((s) => s.language)
  const [customPrompts, setCustomPrompts] = useLocalStorage<IPrompt[]>(
    STORAGE_KEYS.CUSTOM_PROMPTS,
    []
  )
  const [selectedPromptId, setSelectedPromptId] = useLocalStorageString(
    STORAGE_KEYS.SELECTED_PROMPT_ID,
    ''
  )

  const allPrompts = useMemo<Prompt[]>(() => {
    const filteredDefaults = DEFAULT_PROMPTS.filter((p) => p.id.endsWith(`_${language}`))
    return [
      ...customPrompts.map((p) => ({ ...p, isDefault: false })),
      ...filteredDefaults.map((p) => ({ ...p, isDefault: true }))
    ]
  }, [customPrompts, language])

  const activePromptText = useMemo<string | null>(() => {
    if (!selectedPromptId) return null
    const prompt = allPrompts.find((p) => p.id === selectedPromptId)
    return prompt?.text || null
  }, [selectedPromptId, allPrompts])

  const addPrompt = useCallback(
    (text: string) => {
      const newPrompt: IPrompt = {
        id: `custom_${Date.now()}`,
        text: text.trim()
      }
      setCustomPrompts((prev) => [newPrompt, ...prev])
      setSelectedPromptId(newPrompt.id)
      return { ...newPrompt, isDefault: false }
    },
    [setCustomPrompts, setSelectedPromptId]
  )

  const deletePrompt = useCallback(
    (id: string) => {
      setCustomPrompts((prev) => prev.filter((p) => p.id !== id))
      if (selectedPromptId === id) {
        setSelectedPromptId('')
      }
    },
    [setCustomPrompts, selectedPromptId, setSelectedPromptId]
  )

  const selectPrompt = useCallback(
    (id: string) => {
      if (selectedPromptId === id) {
        setSelectedPromptId('')
      } else {
        setSelectedPromptId(id)
      }
    },
    [selectedPromptId, setSelectedPromptId]
  )

  const clearSelection = useCallback(() => {
    setSelectedPromptId('')
  }, [setSelectedPromptId])

  return {
    allPrompts,
    activePromptText,
    selectedPromptId: selectedPromptId || null,

    addPrompt,
    deletePrompt,
    selectPrompt,
    clearSelection
  }
}
