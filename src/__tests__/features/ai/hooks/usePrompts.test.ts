import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { usePrompts } from '@features/ai/hooks/usePrompts'

const mockSetCustomPrompts = vi.fn()
const mockSetSelectedPromptId = vi.fn()

vi.mock('@app/providers/LanguageContext', () => ({
  useLanguage: (selector?: (s: { language: string }) => string) => {
    const state = { language: 'en' }
    return selector ? selector(state) : state
  }
}))

vi.mock('@shared/hooks/useLocalStorage', () => ({
  useLocalStorage: (_key: string, initial: any) => [initial, mockSetCustomPrompts],
  useLocalStorageString: (_key: string, initial: any) => [initial, mockSetSelectedPromptId]
}))

vi.mock('@shared/constants/prompts', () => ({
  DEFAULT_PROMPTS: [
    { id: 'p1_en', text: 'Prompt 1 EN' },
    { id: 'p1_tr', text: 'Prompt 1 TR' },
    { id: 'p2_en', text: 'Prompt 2 EN' }
  ],
  STORAGE_KEYS: {
    CUSTOM_PROMPTS: 'custom_prompts',
    SELECTED_PROMPT_ID: 'selected_prompt_id'
  }
}))

describe('usePrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters default prompts by language', () => {
    const { result } = renderHook(() => usePrompts())

    const defaultPrompts = result.current.allPrompts.filter((p) => p.isDefault)
    expect(defaultPrompts).toHaveLength(2)
    expect(defaultPrompts.find((p) => p.id === 'p1_en')).toBeDefined()
    expect(defaultPrompts.find((p) => p.id === 'p2_en')).toBeDefined()
    expect(defaultPrompts.find((p) => p.id === 'p1_tr')).toBeUndefined()
  })

  it('adds a new prompt', () => {
    const { result } = renderHook(() => usePrompts())

    act(() => {
      result.current.addPrompt('New Prompt')
    })

    expect(mockSetCustomPrompts).toHaveBeenCalled()
    const updateFn = mockSetCustomPrompts.mock.calls[0][0]
    const newState = updateFn([])
    expect(newState).toHaveLength(1)
    expect(newState[0].text).toBe('New Prompt')

    expect(mockSetSelectedPromptId).toHaveBeenCalledWith(expect.stringContaining('custom_'))
  })

  it('toggles prompt selection', () => {
    const { result } = renderHook(() => usePrompts())

    act(() => {
      result.current.selectPrompt('p1_en')
    })
    expect(mockSetSelectedPromptId).toHaveBeenCalledWith('p1_en')
  })

  it('deletes a prompt', () => {
    const { result } = renderHook(() => usePrompts())

    act(() => {
      result.current.deletePrompt('custom_1')
    })

    expect(mockSetCustomPrompts).toHaveBeenCalled()
    const updateFn = mockSetCustomPrompts.mock.calls[0][0]
    const existing = [
      { id: 'custom_1', text: 'A' },
      { id: 'custom_2', text: 'B' }
    ]
    const newState = updateFn(existing)
    expect(newState).toHaveLength(1)
    expect(newState[0].id).toBe('custom_2')
  })
})
