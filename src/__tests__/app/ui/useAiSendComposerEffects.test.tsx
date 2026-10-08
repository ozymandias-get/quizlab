/**
 * `useAiSendComposerClickOutside` — the outside click that clears the composer.
 *
 * The clear is guarded: it asks for confirmation and only wipes the note when the
 * user accepts. The hook therefore takes the guarded routine and must call
 * **only** that. It used to also take a separate `clearNote` and call it
 * unconditionally, which meant a click outside that the user then *cancelled*
 * still wiped the draft note — the confirmation dialog was asking about a note
 * that had already gone.
 *
 * The parameter is gone rather than merely unused, so under the old signature a
 * four-argument call binds the guarded routine to `clearNote` and leaves
 * `onClearAll` undefined. The listener then throws a `TypeError` — and jsdom
 * routes listener exceptions to the virtual console rather than failing the
 * test, so a note-value assertion alone cannot tell the two versions apart. The
 * observable difference is that the error never happens, which is what the first
 * case asserts.
 */
import { useAiSendComposerClickOutside } from '@app/ui/aiSendComposer/useAiSendComposerEffects'

import { act, fireEvent, renderHook } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useAiSendComposerClickOutside', () => {
  let listenerErrors: unknown[]

  beforeEach(() => {
    listenerErrors = []
    window.addEventListener('error', captureListenerError)
  })

  afterEach(() => {
    window.removeEventListener('error', captureListenerError)
  })

  function captureListenerError(event: Event): void {
    listenerErrors.push((event as ErrorEvent).error)
  }

  /**
   * Mounts the hook with a guarded clear that resolves to `confirmed`, so the
   * only difference between an accept and a cancel is the outcome the user picks.
   */
  function mount(confirmed: boolean) {
    const clearQueue = vi.fn()
    const onClearAll = vi.fn(async () => {
      const accepted = await Promise.resolve(confirmed)
      if (!accepted) return
      setNoteForHook('')
      clearQueue()
    })
    let setNoteForHook: (value: string) => void = () => {}

    const view = renderHook(() => {
      const [note, setNote] = useState('Explain both selections')
      setNoteForHook = setNote
      const asideRef = useRef(document.createElement('aside'))
      useAiSendComposerClickOutside(false, 2, asideRef, onClearAll)
      return note
    })

    return { view, clearQueue, onClearAll }
  }

  it('keeps the note when the guarded clear is cancelled, without erroring', async () => {
    const { view, clearQueue } = mount(false)

    await act(async () => {
      fireEvent.mouseDown(document.body)
    })

    expect(view.result.current).toBe('Explain both selections')
    expect(clearQueue).not.toHaveBeenCalled()
    // The signature change is only observable here: with the old extra
    // `clearNote` parameter, this call binds the guarded routine to it and the
    // listener throws on the undefined `onClearAll`.
    expect(listenerErrors).toEqual([])
  })

  it('clears the note when the guarded clear is accepted', async () => {
    const { view, clearQueue, onClearAll } = mount(true)

    await act(async () => {
      fireEvent.mouseDown(document.body)
    })

    expect(onClearAll).toHaveBeenCalledTimes(1)
    expect(clearQueue).toHaveBeenCalledTimes(1)
    expect(view.result.current).toBe('')
    expect(listenerErrors).toEqual([])
  })

  it('ignores the click while submitting', async () => {
    const clearQueue = vi.fn()
    const onClearAll = vi.fn()
    const view = renderHook(() => {
      const asideRef = useRef(document.createElement('aside'))
      useAiSendComposerClickOutside(true, 2, asideRef, onClearAll)
    })

    await act(async () => {
      fireEvent.mouseDown(document.body)
    })

    expect(onClearAll).not.toHaveBeenCalled()
    expect(clearQueue).not.toHaveBeenCalled()
    expect(view.result.current).toBeUndefined()
  })

  it('ignores the click that lands inside the composer', async () => {
    const onClearAll = vi.fn()
    const aside = document.createElement('aside')
    aside.appendChild(document.createElement('button'))
    document.body.appendChild(aside)
    const asideRef = { current: aside }
    renderHook(() => useAiSendComposerClickOutside(false, 2, asideRef, onClearAll))

    await act(async () => {
      fireEvent.mouseDown(aside)
    })

    // A click on the composer body is the user interacting with what they are
    // composing; clearing it would be the same data loss as a cancelled confirm.
    expect(onClearAll).not.toHaveBeenCalled()
    document.body.removeChild(aside)
  })
})
