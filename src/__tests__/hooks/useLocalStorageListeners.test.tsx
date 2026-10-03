/**
 * Regression tests for the storage hooks' listener lifecycle.
 *
 * The hooks install two window listeners (cross-tab `storage` + same-tab
 * custom event). Their callbacks used to close over inline `serialize` /
 * `deserialize` / `validate` arrows, so the listeners were torn down and
 * re-added on every render of every consumer.
 */
import {
  useLocalStorage,
  useLocalStorageBoolean,
  useLocalStorageString
} from '@shared/hooks/useLocalStorage'

import { act, render, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useLocalStorage listener lifecycle', () => {
  let addSpy: ReturnType<typeof vi.spyOn>
  let removeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    addSpy = vi.spyOn(window, 'addEventListener')
    removeSpy = vi.spyOn(window, 'removeEventListener')
  })

  /** Counts listeners registered for the two sync events, ignoring React's own. */
  const syncListenerOps = () => {
    const isSyncEvent = ([type]: unknown[]) => type === 'storage' || type === 'local-storage'
    const added = addSpy.mock.calls.filter(isSyncEvent).length
    const removed = removeSpy.mock.calls.filter(isSyncEvent).length
    return { added, removed }
  }

  it('does not re-register storage listeners across re-renders', () => {
    const { result, rerender } = renderHook(() =>
      useLocalStorage<boolean>('quizlab_test_listen', false)
    )

    expect(syncListenerOps().added).toBe(2)

    for (let i = 0; i < 10; i++) rerender()

    // Ten extra renders must not produce a single add/remove pair.
    expect(syncListenerOps().added).toBe(2)
    expect(syncListenerOps().removed).toBe(0)

    act(() => {
      result.current[1](true)
    })
    expect(localStorage.getItem('quizlab_test_listen')).toBe('true')
  })

  it('does not re-register storage listeners for the boolean variant', () => {
    const { rerender } = renderHook(() => useLocalStorageBoolean('quizlab_test_bool', false))

    expect(syncListenerOps().added).toBe(2)

    for (let i = 0; i < 10; i++) rerender()

    expect(syncListenerOps().added).toBe(2)
    expect(syncListenerOps().removed).toBe(0)
  })

  it('keeps a stable setter identity across re-renders', () => {
    const { result, rerender } = renderHook(() => useLocalStorage('quizlab_test_setter', 'a'))
    const firstSetter = result.current[1]

    for (let i = 0; i < 10; i++) rerender()

    expect(result.current[1]).toBe(firstSetter)
  })

  it('still syncs same-tab writes from another hook instance', () => {
    const { result: writer } = renderHook(() => useLocalStorage('quizlab_test_sync', 'a'))
    const { result: reader } = renderHook(() => useLocalStorage('quizlab_test_sync', 'a'))

    act(() => {
      writer.current[1]('updated')
    })

    expect(reader.current[0]).toBe('updated')
  })

  it('still honours validValues in the string variant', () => {
    const localStorageKey = 'quizlab_test_valid'
    // useLocalStorageString uses identity (de)serialisation: the raw string.
    localStorage.setItem(localStorageKey, 'tr')

    const { result } = renderHook(() =>
      useLocalStorageString(localStorageKey, 'en', ['en', 'tr', 'de'])
    )

    expect(result.current[0]).toBe('tr')
  })

  it('rejects a stored value outside validValues', () => {
    const localStorageKey = 'quizlab_test_invalid_lang'
    localStorage.setItem(localStorageKey, 'zz')

    const { result } = renderHook(() => useLocalStorageString(localStorageKey, 'en', ['en', 'tr']))

    expect(result.current[0]).toBe('en')
  })

  it('falls back to the initial value when the stored shape is invalid', () => {
    const localStorageKey = 'quizlab_test_shape'
    localStorage.setItem(localStorageKey, JSON.stringify({ not: 'a string' }))

    const { result } = renderHook(() => useLocalStorage(localStorageKey, 'en'))

    expect(result.current[0]).toBe('en')
  })

  it('removes its listeners on unmount', () => {
    const { unmount } = renderHook(() => useLocalStorage('quizlab_test_unmount', false))

    expect(syncListenerOps().added).toBe(2)
    unmount()
    expect(syncListenerOps().removed).toBe(2)
  })

  it('adds and removes exactly one listener pair per mounted consumer', () => {
    function Pair() {
      useLocalStorage('quizlab_test_a', false)
      useLocalStorage('quizlab_test_b', false)
      return null
    }

    const { unmount } = render(<Pair />)

    expect(syncListenerOps().added).toBe(4)
    unmount()
    expect(syncListenerOps().removed).toBe(4)
  })
})
