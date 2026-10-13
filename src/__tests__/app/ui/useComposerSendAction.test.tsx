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

  it('returns to idle after a delivered result, with no success badge', async () => {
    const { result } = setup(true)

    await act(async () => {
      await result.current.handleSend()
    })

    // Delivery is silent: the queue empties and the panel closes, which is the
    // confirmation. A "sent" badge would only restate it.
    expect(result.current.sendFeedback).toBe('idle')
    expect(result.current.lastError).toBeNull()
  })

  // A staged outcome was accepted but never delivered, so it must not report
  // "sent" either. Success feedback is gone entirely, so it reports nothing.
  it('returns to idle after a staged result, never claiming delivery', async () => {
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
    expect(result.current.lastError).toBeNull()
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

  /**
   * Eşzamanlı gönderim kilidi render zamanlamasına bağlı değildir.
   *
   * `isSubmitting` bir sonraki render'da güncellenir; aynı olay içindeki ikinci
   * tıklama eski `false` değerini görür ve gönderimi yeniden başlatırdı.
   */
  describe('same-tick double send', () => {
    it('starts only one send when two triggers fire in the same event', async () => {
      let release!: (v: unknown) => void
      const onSend = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            release = resolve
          })
      )
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

      // İki ayrı tetikleyici: paneldeki düğme ve Ctrl/Cmd+Enter.
      let first!: Promise<void>
      act(() => {
        first = result.current.handleSend({ noteText: 'Explain' })
        void result.current.handleSend({ noteText: 'Explain' })
      })
      expect(onSend).toHaveBeenCalledTimes(1)

      await act(async () => {
        release({ success: true })
        await first
      })
    })

    it('does not surface an error when the pipeline reports a concurrent send', async () => {
      const onSend = vi.fn(async () => ({ success: false, error: 'send_in_progress' }) as unknown)
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

      // Eşzamanlılık bir hata değildir: süren gönderimin durumu bozulmaz.
      expect(result.current.sendFeedback).not.toBe('error')
      expect(result.current.lastError).toBeNull()
    })
  })

  /**
   * Geri bildirim zamanlayıcısı bir önceki gönderimin sonucunu ikinciyi
   * etkilememeli. Aksi halde ikinci gönderim sürerken durum `idle`'a düşer ve
   * kullanıcı "gönderim bitti" yanılgısına düşerdi.
   */
  describe('feedback timers', () => {
    beforeEach(() => vi.useFakeTimers())

    it('does not let a stale feedback timer reset a running send', async () => {
      // Success no longer schedules anything — only an error does. The
      // invariant is unchanged and still worth guarding: a timer left over from
      // an earlier send must not pull a running send back to `idle`.
      let releaseSecond!: (v: unknown) => void
      let call = 0
      const onSend = vi.fn(() => {
        call += 1
        if (call === 1) return Promise.resolve({ success: false, error: 'paste_failed' })
        return new Promise<unknown>((resolve) => {
          releaseSecond = resolve
        })
      })
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

      // İkinci gönderim başlar; ilk hatanın 6000 ms'lik sayacı sırada.
      let second!: Promise<void>
      act(() => {
        second = result.current.handleSend()
      })
      expect(result.current.sendFeedback).toBe('sending')

      // Eski sayac dolar: gönderim hâlâ sürüyor, durum `idle` olmamalı.
      await act(async () => {
        vi.advanceTimersByTime(7000)
      })
      expect(result.current.sendFeedback).toBe('sending')

      await act(async () => {
        releaseSecond({ success: true })
        await second
      })
      expect(result.current.sendFeedback).toBe('idle')
    })

    it('clears the pending timer on unmount', async () => {
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
      const onSend = vi.fn(async () => ({ success: false, error: 'paste_failed' }) as unknown)
      const { result, unmount } = renderHook(() =>
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

      clearSpy.mockClear()
      unmount()
      expect(clearSpy).toHaveBeenCalled()
      clearSpy.mockRestore()
    })
  })

  /**
   * "Tekrar dene" düğmesinin etiketiyle yaptığı eylem aynı olmalı:
   *  - güvenle tekrarlanabilir hata → son gönderim niyeti **yeniden yürütülür**;
   *  - kısmen uygulanmış gönderim → **yeniden gönderilmez**; kullanıcı
   *    bilgilendirilir ve durumu kapatabilir (mükerrer mesaj koruması).
   */
  describe('retry contract', () => {
    function setupWith(onSend: (payload: Payload) => Promise<unknown>) {
      return renderHook(() =>
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
    }

    it('re-runs the last send intent for a safely repeatable failure', async () => {
      const onSend = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockResolvedValueOnce({ success: false, error: 'paste_failed' })
        .mockResolvedValueOnce({ success: true })
      const { result } = setupWith(onSend)

      await act(async () => {
        await result.current.handleSend({ noteText: 'Explain this', autoSend: true })
      })
      expect(result.current.sendFeedback).toBe('error')

      await act(async () => {
        result.current.handleRetry()
      })

      expect(onSend).toHaveBeenCalledTimes(2)
      // Aynı niyet, aynı içerik: veri kaybı yok.
      expect(onSend.mock.calls[1][0]).toEqual(onSend.mock.calls[0][0])
      // The successful retry is silent, like any other successful send.
      expect(result.current.sendFeedback).toBe('idle')
      expect(result.current.lastError).toBeNull()
    })

    it('never auto-resends when the content already reached the target', async () => {
      const onSend = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
      const { result } = setupWith(onSend)

      await act(async () => {
        await result.current.handleSend({ noteText: 'Explain this' })
      })
      expect(result.current.sendFeedback).toBe('incomplete')
      expect(result.current.isResendSafe).toBe(false)

      await act(async () => {
        result.current.handleRetry()
        result.current.handleRetry()
      })

      // "Tekrar dene" ikinci bir kopya bırakmaz: gönderim yeniden başlatılmaz.
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('lets the user dismiss an incomplete outcome without losing the draft', async () => {
      const onSend = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
      const { result } = setupWith(onSend)

      await act(async () => {
        await result.current.handleSend({ noteText: 'Explain this' })
      })
      act(() => {
        result.current.dismissOutcome()
      })

      expect(result.current.sendFeedback).toBe('idle')
      expect(result.current.lastError).toBeNull()
      // Not ve kuyruk bu hook'a bağlı değil; hiçbir temizleme çağrısı yapılmaz.
      expect(onSend).toHaveBeenCalledTimes(1)
    })
  })
})
