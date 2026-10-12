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

  // Regression: an earlier change made the send affordances force a send, which
  // overrode a setting the user had deliberately turned off. With auto-send off the
  // composer must only stage the content and let the user submit on the site.
  //
  // Both send buttons — the one in the panel and the one on the collapsed pill —
  // now go through `handleSend` alone (there is no separate "force" variant to get
  // out of sync), so the invariant is asserted on that single path.
  it('does not force a send when auto-send is off', async () => {
    const { result, onSend } = setup(false)

    await act(async () => {
      await result.current.handleSend()
    })

    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ autoSend: false }))
    // The escape hatch is gone entirely, not merely set to false.
    expect(sentPayloadKeys(onSend)).not.toContain('forceAutoSend')
  })

  it('passes an explicit instruction through without touching auto-send', async () => {
    const { result, onSend } = setup(false)

    await act(async () => {
      await result.current.handleSend({ noteText: 'Explain this' })
    })

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ noteText: 'Explain this', autoSend: false })
    )
    expect(sentPayloadKeys(onSend)).not.toContain('forceAutoSend')
  })

  it('passes auto-send through when auto-send is on', async () => {
    const { result, onSend } = setup(true)

    await act(async () => {
      await result.current.handleSend()
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
  // would be a lie. It must not report "sent"; the prepared state is its own
  // feedback, not the delivered one.
  it('reports a staged result as staged, never as sent', async () => {
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

    expect(result.current.sendFeedback).toBe('staged')
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
