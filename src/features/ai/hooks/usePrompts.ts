import { useMemo, useCallback } from 'react'
import { useLanguage } from '@src/app/providers'
import { useLocalStorage, useLocalStorageString } from '@src/hooks/useLocalStorage'
import { STORAGE_KEYS } from '@src/constants/storageKeys'
import { DEFAULT_PROMPTS, IPrompt } from '@src/constants/prompts'

export interface Prompt extends IPrompt {
    isDefault?: boolean;
}

interface UsePromptsReturn {
    allPrompts: Prompt[];
    activePrompt: Prompt | null;
    activePromptText: string | null;
    selectedPromptId: string | null;
    addPrompt: (text: string) => Prompt;
    deletePrompt: (id: string) => void;
    selectPrompt: (id: string) => void;
    clearSelection: () => void;
}

/**
 * Hook for managing prompts system
 * Centralizes logic for fetching, adding, deleting and selecting prompts.
 */
export function usePrompts(): UsePromptsReturn {
    const { language } = useLanguage()
    const [customPrompts, setCustomPrompts] = useLocalStorage<IPrompt[]>(STORAGE_KEYS.CUSTOM_PROMPTS, [])
    const [selectedPromptId, setSelectedPromptId] = useLocalStorageString(STORAGE_KEYS.SELECTED_PROMPT_ID, '')

    // Combine default and custom prompts
    const allPrompts = useMemo<Prompt[]>(() => {
        const filteredDefaults = DEFAULT_PROMPTS.filter(p => p.id.endsWith(`_${language}`))
        return [
            ...filteredDefaults.map(p => ({ ...p, isDefault: true })),
            ...customPrompts.map((p: IPrompt) => ({ ...p, isDefault: false }))
        ]
    }, [customPrompts, language])

    // Get the currently selected prompt text
    const activePrompt = useMemo<Prompt | null>(() => {
        if (!selectedPromptId) return null
        return allPrompts.find(p => p.id === selectedPromptId) || null
    }, [selectedPromptId, allPrompts])

    const activePromptText = activePrompt?.text || null

    // Actions
    const addPrompt = useCallback((text: string) => {
        const newPrompt: IPrompt = {
            id: `custom_${Date.now()}`,
            text: text.trim()
        }
        setCustomPrompts((prev: IPrompt[]) => [...prev, newPrompt])
        // Auto select newly created prompt
        setSelectedPromptId(newPrompt.id)
        return { ...newPrompt, isDefault: false }
    }, [setCustomPrompts, setSelectedPromptId])

    const deletePrompt = useCallback((id: string) => {
        setCustomPrompts((prev: IPrompt[]) => prev.filter(p => p.id !== id))
        if (selectedPromptId === id) {
            setSelectedPromptId('')
        }
    }, [setCustomPrompts, selectedPromptId, setSelectedPromptId])

    const selectPrompt = useCallback((id: string) => {
        // Toggle logic: if already selected, deselect
        if (selectedPromptId === id) {
            setSelectedPromptId('')
        } else {
            setSelectedPromptId(id)
        }
    }, [selectedPromptId, setSelectedPromptId])

    const clearSelection = useCallback(() => {
        setSelectedPromptId('')
    }, [setSelectedPromptId])

    return {
        // State
        allPrompts,
        activePrompt,
        activePromptText,
        selectedPromptId: selectedPromptId || null,

        // Actions
        addPrompt,
        deletePrompt,
        selectPrompt,
        clearSelection
    }
}


