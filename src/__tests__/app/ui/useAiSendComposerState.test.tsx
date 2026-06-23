import { useAiSendComposerState } from '@app/ui/aiSendComposer/useAiSendComposerState'

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('useAiSendComposerState', () => {
  it('starts with empty note and not submitting', () => {
    const { result } = renderHook(() => useAiSendComposerState())
    expect(result.current.noteText).toBe('')
    expect(result.current.isSubmitting).toBe(false)
  })

  it('updates note text via setNoteText', () => {
    const { result } = renderHook(() => useAiSendComposerState())
    act(() => result.current.setNoteText('hello'))
    expect(result.current.noteText).toBe('hello')
  })

  it('clears the note via clearNote', () => {
    const { result } = renderHook(() => useAiSendComposerState())
    act(() => result.current.setNoteText('something'))
    act(() => result.current.clearNote())
    expect(result.current.noteText).toBe('')
  })

  it('toggles isSubmitting state', () => {
    const { result } = renderHook(() => useAiSendComposerState())
    act(() => result.current.setIsSubmitting(true))
    expect(result.current.isSubmitting).toBe(true)
    act(() => result.current.setIsSubmitting(false))
    expect(result.current.isSubmitting).toBe(false)
  })

  it('clearNote does not affect isSubmitting', () => {
    const { result } = renderHook(() => useAiSendComposerState())
    act(() => result.current.setIsSubmitting(true))
    act(() => result.current.clearNote())
    expect(result.current.isSubmitting).toBe(true)
  })
})
