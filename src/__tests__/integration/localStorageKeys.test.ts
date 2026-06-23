import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage } from '@shared/hooks/useLocalStorage'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

describe('Integration: useLocalStorage + STORAGE_KEYS', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists panel width and reads it back', () => {
    const { result } = renderHook(() => useLocalStorage<number>(STORAGE_KEYS.LEFT_PANEL_WIDTH, 50))

    expect(result.current[0]).toBe(50)

    act(() => {
      result.current[1](65)
    })

    expect(result.current[0]).toBe(65)
    expect(window.localStorage.getItem(STORAGE_KEYS.LEFT_PANEL_WIDTH)).toBe('65')
  })

  it('persists language preference', () => {
    const { result } = renderHook(() => useLocalStorage<string>(STORAGE_KEYS.APP_LANGUAGE, 'tr'))

    expect(result.current[0]).toBe('tr')

    act(() => {
      result.current[1]('en')
    })

    expect(result.current[0]).toBe('en')
    expect(window.localStorage.getItem(STORAGE_KEYS.APP_LANGUAGE)).toBe(JSON.stringify('en'))
  })

  it('persists enabled models list', () => {
    const { result } = renderHook(() =>
      useLocalStorage<string[]>(STORAGE_KEYS.ENABLED_MODELS, ['chatgpt', 'gemini'])
    )

    expect(result.current[0]).toEqual(['chatgpt', 'gemini'])

    act(() => {
      result.current[1](['chatgpt', 'gemini', 'claude'])
    })

    expect(result.current[0]).toEqual(['chatgpt', 'gemini', 'claude'])
  })

  it('persists custom prompts', () => {
    const initial: Array<{ id: string; text: string }> = []
    const { result } = renderHook(() => useLocalStorage(STORAGE_KEYS.CUSTOM_PROMPTS, initial))

    const newPrompt = { id: 'custom-1', text: 'My custom prompt' }

    act(() => {
      result.current[1]([newPrompt])
    })

    expect(result.current[0]).toEqual([newPrompt])
  })

  it('persists last selected AI model', () => {
    const { result } = renderHook(() =>
      useLocalStorage<string>(STORAGE_KEYS.LAST_SELECTED_AI, 'chatgpt')
    )

    act(() => {
      result.current[1]('gemini')
    })

    expect(window.localStorage.getItem(STORAGE_KEYS.LAST_SELECTED_AI)).toBe(
      JSON.stringify('gemini')
    )
  })

  it('persists auto-send enabled state', () => {
    const { result } = renderHook(() =>
      useLocalStorage<boolean>(STORAGE_KEYS.AUTO_SEND_ENABLED, false)
    )

    expect(result.current[0]).toBe(false)

    act(() => {
      result.current[1](true)
    })

    expect(window.localStorage.getItem(STORAGE_KEYS.AUTO_SEND_ENABLED)).toBe('true')
  })

  it('multiple storage keys work independently', () => {
    const { result: langResult } = renderHook(() =>
      useLocalStorage(STORAGE_KEYS.APP_LANGUAGE, 'tr')
    )
    const { result: widthResult } = renderHook(() =>
      useLocalStorage(STORAGE_KEYS.LEFT_PANEL_WIDTH, 50)
    )

    act(() => {
      langResult.current[1]('en')
    })

    act(() => {
      widthResult.current[1](75)
    })

    expect(langResult.current[0]).toBe('en')
    expect(widthResult.current[0]).toBe(75)
  })
})
