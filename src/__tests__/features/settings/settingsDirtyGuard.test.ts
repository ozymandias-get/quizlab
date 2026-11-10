import {
  resetSettingsDirty,
  setSettingsDirty,
  useHasDirtySettings,
  useSettingsDirty
} from '@features/settings/ui/modal/settingsDirtyGuard'

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => {
  resetSettingsDirty()
})

describe('settings dirty guard', () => {
  it('tracks a form registration until the form unmounts', () => {
    const hasDirty = renderHook(() => useHasDirtySettings())
    expect(hasDirty.result.current).toBe(false)

    const form = renderHook(({ dirty }: { dirty: boolean }) => useSettingsDirty('form-a', dirty), {
      initialProps: { dirty: false }
    })
    expect(hasDirty.result.current).toBe(false)

    form.rerender({ dirty: true })
    expect(hasDirty.result.current).toBe(true)

    // Reverting the edit clears the flag even though the form is still mounted.
    form.rerender({ dirty: false })
    expect(hasDirty.result.current).toBe(false)

    form.rerender({ dirty: true })
    expect(hasDirty.result.current).toBe(true)

    form.unmount()
    expect(hasDirty.result.current).toBe(false)
  })

  it('needs every form to be clean before the modal reports no unsaved changes', () => {
    const hasDirty = renderHook(() => useHasDirtySettings())

    act(() => {
      setSettingsDirty('form-a', true)
      setSettingsDirty('form-b', true)
    })
    expect(hasDirty.result.current).toBe(true)

    act(() => setSettingsDirty('form-a', false))
    expect(hasDirty.result.current).toBe(true)

    act(() => setSettingsDirty('form-b', false))
    expect(hasDirty.result.current).toBe(false)
  })

  it('reset drops every registration at once', () => {
    const hasDirty = renderHook(() => useHasDirtySettings())

    act(() => {
      setSettingsDirty('form-a', true)
      setSettingsDirty('form-b', true)
    })
    expect(hasDirty.result.current).toBe(true)

    act(() => resetSettingsDirty())
    expect(hasDirty.result.current).toBe(false)
  })
})
