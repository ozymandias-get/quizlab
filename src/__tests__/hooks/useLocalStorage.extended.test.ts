import {
  useLocalStorage,
  useLocalStorageBoolean,
  useLocalStorageString
} from '@shared/hooks/useLocalStorage'

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fireLocalStorageSyncEvent, fireStorageEvent } from '../helpers/test-utils'

describe('useLocalStorage - Extended Tests', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('returns initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('new-key', { default: true }))
      expect(result.current[0]).toEqual({ default: true })
    })

    it('returns stored value when localStorage has data', () => {
      window.localStorage.setItem('existing-key', JSON.stringify({ stored: true }))
      const { result } = renderHook(() => useLocalStorage('existing-key', { default: false }))
      expect(result.current[0]).toEqual({ stored: true })
    })

    it('returns initial value for corrupted localStorage data', () => {
      window.localStorage.setItem('corrupted-key', '{invalid json')
      const { result } = renderHook(() => useLocalStorage('corrupted-key', 'fallback'))
      expect(result.current[0]).toBe('fallback')
    })

    it('returns initial value when stored shape mismatches', () => {
      window.localStorage.setItem('shape-key', JSON.stringify([1, 2, 3]))
      const { result } = renderHook(() => useLocalStorage('shape-key', { expected: 'shape' }))
      expect(result.current[0]).toEqual({ expected: 'shape' })
    })
  })

  describe('setting values', () => {
    it('updates state and localStorage on direct value set', () => {
      const { result } = renderHook(() => useLocalStorage('set-key', 'initial'))

      act(() => {
        result.current[1]('updated')
      })

      expect(result.current[0]).toBe('updated')
      expect(window.localStorage.getItem('set-key')).toBe(JSON.stringify('updated'))
    })

    it('updates state and localStorage on function updater', () => {
      const { result } = renderHook(() => useLocalStorage<number>('count-key', 0))

      act(() => {
        result.current[1]((prev) => prev + 1)
      })

      expect(result.current[0]).toBe(1)
      expect(window.localStorage.getItem('count-key')).toBe('1')
    })

    it('does not write to localStorage when value is unchanged', () => {
      const { result } = renderHook(() => useLocalStorage('unchanged-key', 'same'))
      const setItemSpy = vi.spyOn(window.localStorage, 'setItem')

      act(() => {
        result.current[1]('same')
      })

      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it('handles complex object updates', () => {
      const { result } = renderHook(() =>
        useLocalStorage('complex-key', { items: [] as string[], count: 0 })
      )

      act(() => {
        result.current[1]((prev) => ({
          ...prev,
          items: [...prev.items, 'new-item'],
          count: prev.count + 1
        }))
      })

      expect(result.current[0]).toEqual({ items: ['new-item'], count: 1 })
    })
  })

  describe('cross-tab synchronization', () => {
    it('syncs state when localStorage changes in another tab', async () => {
      const { result } = renderHook(() => useLocalStorage('sync-key', 'initial'))

      act(() => {
        fireStorageEvent('sync-key', JSON.stringify('from-other-tab'))
      })

      await waitFor(() => {
        expect(result.current[0]).toBe('from-other-tab')
      })
    })

    it('syncs via custom local-storage event', async () => {
      const { result } = renderHook(() => useLocalStorage('custom-sync', 'initial'))

      act(() => {
        fireLocalStorageSyncEvent('custom-sync', JSON.stringify('custom-event-value'))
      })

      await waitFor(() => {
        expect(result.current[0]).toBe('custom-event-value')
      })
    })

    it('ignores sync events for different keys', async () => {
      const { result } = renderHook(() => useLocalStorage('my-key', 'initial'))

      act(() => {
        fireStorageEvent('other-key', JSON.stringify('different'))
      })

      await waitFor(() => {
        expect(result.current[0]).toBe('initial')
      })
    })

    it('resets to initial value when localStorage item is removed', async () => {
      const { result } = renderHook(() => useLocalStorage('remove-key', 'default'))

      act(() => {
        result.current[1]('custom')
      })
      expect(result.current[0]).toBe('custom')

      act(() => {
        fireStorageEvent('remove-key', null)
      })

      await waitFor(() => {
        expect(result.current[0]).toBe('default')
      })
    })
  })

  describe('error handling', () => {
    it('returns initial value when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage access denied')
      })

      const { result } = renderHook(() => useLocalStorage('error-key', 'safe-fallback'))
      expect(result.current[0]).toBe('safe-fallback')
    })

    it('does not crash when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      const { result } = renderHook(() => useLocalStorage('quota-key', 'initial'))

      // Should not throw
      act(() => {
        result.current[1]('updated')
      })

      // State should still update even if localStorage write fails
      expect(result.current[0]).toBe('updated')
    })
  })
})

describe('useLocalStorageString - Extended Tests', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns initial value when storage is empty', () => {
    const { result } = renderHook(() => useLocalStorageString('str-empty', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('reads raw string from localStorage', () => {
    window.localStorage.setItem('str-raw', 'hello world')
    const { result } = renderHook(() => useLocalStorageString('str-raw', 'default'))
    expect(result.current[0]).toBe('hello world')
  })

  it('validates against allowed values', () => {
    const { result } = renderHook(() =>
      useLocalStorageString('str-valid', 'light', ['dark', 'light', 'auto'])
    )

    act(() => {
      result.current[1]('dark')
    })
    expect(result.current[0]).toBe('dark')

    act(() => {
      result.current[1]('invalid')
    })
    // Should not change to invalid value
    expect(result.current[0]).toBe('dark')
  })

  it('allows any value when no validValues provided', () => {
    const { result } = renderHook(() => useLocalStorageString('str-any', 'default'))

    act(() => {
      result.current[1]('anything-goes')
    })
    expect(result.current[0]).toBe('anything-goes')
  })

  it('resets to initial when stored value becomes invalid', () => {
    window.localStorage.setItem('str-reset', 'invalid-value')
    const { result } = renderHook(() => useLocalStorageString('str-reset', 'default', ['valid']))

    expect(result.current[0]).toBe('default')
  })
})

describe('useLocalStorageBoolean - Extended Tests', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns initial value when storage is empty', () => {
    const { result } = renderHook(() => useLocalStorageBoolean('bool-empty', false))
    expect(result.current[0]).toBe(false)
  })

  it('parses "true" string as boolean true', () => {
    window.localStorage.setItem('bool-true', 'true')
    const { result } = renderHook(() => useLocalStorageBoolean('bool-true', false))
    expect(result.current[0]).toBe(true)
  })

  it('parses "false" string as boolean false', () => {
    window.localStorage.setItem('bool-false', 'false')
    const { result } = renderHook(() => useLocalStorageBoolean('bool-false', true))
    expect(result.current[0]).toBe(false)
  })

  it('returns initial for non-boolean stored values', () => {
    window.localStorage.setItem('bool-invalid', 'not-a-bool')
    const { result } = renderHook(() => useLocalStorageBoolean('bool-invalid', true))
    expect(result.current[0]).toBe(true)
  })

  it('toggle function flips the value', () => {
    const { result } = renderHook(() => useLocalStorageBoolean('bool-toggle', false))

    act(() => {
      result.current[2]()
    })
    expect(result.current[0]).toBe(true)

    act(() => {
      result.current[2]()
    })
    expect(result.current[0]).toBe(false)
  })

  it('toggle persists to localStorage', () => {
    const { result } = renderHook(() => useLocalStorageBoolean('bool-persist', false))

    act(() => {
      result.current[2]()
    })

    expect(window.localStorage.getItem('bool-persist')).toBe('true')
  })
})
