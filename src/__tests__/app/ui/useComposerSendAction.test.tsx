import { useComposerSendAction } from '@app/ui/aiSendComposer/useComposerSendAction'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Payload = { noteText?: string; autoSend?: boolean }

function setup(autoSend = false) {
  const onSend = vi.fn(async (_payload: Payload) => ({ success: true }) as unknown)
  const setIsExpanded = vi.fn()
  const setStoredExpanded = vi.fn()
  const { result } = renderHook(() =>
    useComposerSendAction({
      isSubmitting: false,
      setIsSubmitting: vi.fn(),
      onSend,
      noteText: '',
      effectiveAutoSend: autoSend,
      setIsExpanded,
      setStoredExpanded
    })
  )
  return { result, onSend, setIsExpanded, setStoredExpanded }
}

/** The escape hatch must be gone from the payload, not merely set to false. */
function sentPayloadKeys(onSend: ReturnType<typeof vi.fn>): string[] {
  return Object.keys(onSend.mock.calls[0][0] as Payload)
}

describe('useComposerSendAction', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  // Regression: an earlier change made these force a send, which overrode a
  // setting the user had deliberately turned off. With auto-send off the
  // composer must only stage the content and let the user submit on the site.
  it('does not force a send from the Send button when auto-send is off', async () => {
    const { result, onSend } = setup(false)

    await act(async () => {
      result.current.handleForceSend()
    })

    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ autoSend: false }))
    // The escape hatch is gone entirely, not merely set to false.
    expect(sentPayloadKeys(onSend)).not.toContain('forceAutoSend')
  })

  it('does not force a send from a preset when auto-send is off', async () => {
    const { result, onSend } = setup(false)

    await act(async () => {
      result.current.handleSendWithPreset('Explain this')
    })

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ noteText: 'Explain this', autoSend: false })
    )
    expect(sentPayloadKeys(onSend)).not.toContain('forceAutoSend')
  })

  it('passes auto-send through when auto-send is on', async () => {
    const { result, onSend } = setup(true)

    await act(async () => {
      result.current.handleForceSend()
    })

    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ autoSend: true }))
  })

  it('passes the auto-send preference through for a plain handleSend', async () => {
    const { result, onSend } = setup(false)

    await act(async () => {
      await result.current.handleSend()
    })

    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ autoSend: false }))
  })

  it('shows the success badge for a delivered result', async () => {
    const { result } = setup(true)

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.sendFeedback).toBe('success')
  })

  // A staged outcome was accepted but never delivered, so the green badge
  // would be a lie.
  it('does not show the success badge for a staged result', async () => {
    const onSend = vi.fn(async () => ({ success: true, mode: 'staged' }) as unknown)
    const { result } = renderHook(() =>
      useComposerSendAction({
        isSubmitting: false,
        setIsSubmitting: vi.fn(),
        onSend,
        noteText: '',
        effectiveAutoSend: false,
        setIsExpanded: vi.fn(),
        setStoredExpanded: vi.fn()
      })
    )

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.sendFeedback).toBe('idle')
  })

  it('shows the error state and re-expands for a failed result', async () => {
    const onSend = vi.fn(async () => ({ success: false, error: 'invalid_input' }) as unknown)
    const setIsExpanded = vi.fn()
    const { result } = renderHook(() =>
      useComposerSendAction({
        isSubmitting: false,
        setIsSubmitting: vi.fn(),
        onSend,
        noteText: '',
        effectiveAutoSend: true,
        setIsExpanded,
        setStoredExpanded: vi.fn()
      })
    )

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.sendFeedback).toBe('error')
    expect(result.current.lastError).not.toBeNull()
    expect(setIsExpanded).toHaveBeenCalledWith(true)
  })

  it('shows the error state when the send throws', async () => {
    const onSend = vi.fn(async () => {
      throw new Error('boom')
    }) as unknown as (payload: Payload) => Promise<unknown>
    const { result } = renderHook(() =>
      useComposerSendAction({
        isSubmitting: false,
        setIsSubmitting: vi.fn(),
        onSend,
        noteText: '',
        effectiveAutoSend: true,
        setIsExpanded: vi.fn(),
        setStoredExpanded: vi.fn()
      })
    )

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.sendFeedback).toBe('error')
  })

  it('ignores a send while another one is submitting', async () => {
    const onSend = vi.fn(async () => ({ success: true }) as unknown)
    const { result } = renderHook(() =>
      useComposerSendAction({
        isSubmitting: true,
        setIsSubmitting: vi.fn(),
        onSend,
        noteText: '',
        effectiveAutoSend: true,
        setIsExpanded: vi.fn(),
        setStoredExpanded: vi.fn()
      })
    )

    await act(async () => {
      await result.current.handleSend()
    })

    expect(onSend).not.toHaveBeenCalled()
  })
})
