import {
  useHasDirtySettings,
  useSettingsDirty
} from '@features/settings/ui/modal/settingsDirtyGuard'

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
    const first = renderHook(({ dirty }: { dirty: boolean }) => useSettingsDirty('form-a', dirty), {
      initialProps: { dirty: false }
    })
    const second = renderHook(
      ({ dirty }: { dirty: boolean }) => useSettingsDirty('form-b', dirty),
      { initialProps: { dirty: false } }
    )

    first.rerender({ dirty: true })
    second.rerender({ dirty: true })
    expect(hasDirty.result.current).toBe(true)

    first.rerender({ dirty: false })
    expect(hasDirty.result.current).toBe(true)

    second.rerender({ dirty: false })
    expect(hasDirty.result.current).toBe(false)
  })
})
