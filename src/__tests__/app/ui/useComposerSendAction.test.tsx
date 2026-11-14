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

/**
 * `setup()` yalnızca mutlu yolu kurar. Bu tek giriş noktası, `isSubmitting`,
 * `effectiveAutoSend` ve `onSend` değiştirilmiş her senaryoyu aynı biçimde
 * kurar — altı kez kopyalanan `renderHook(() => useComposerSendAction({...}))`
 * bloğunun yerini alır.
 */
function setupWith(overrides: {
  onSend: (payload: Payload) => Promise<unknown>
  isSubmitting?: boolean
  effectiveAutoSend?: boolean
  onSendSucceeded?: () => void
}) {
  const setIsExpanded = vi.fn()
  const onSendSucceeded = overrides.onSendSucceeded ?? vi.fn()
  const { result, unmount } = renderHook(() =>
    useComposerSendAction({
      isSubmitting: overrides.isSubmitting ?? false,
      setIsSubmitting: vi.fn(),
      onSend: overrides.onSend,
      noteText: '',
      effectiveAutoSend: overrides.effectiveAutoSend ?? true,
      setIsExpanded,
      setStoredExpanded: vi.fn(),
      onSendSucceeded
    })
  )
  return { result, setIsExpanded, unmount, onSendSucceeded }
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

  /**
   * The note describes the draft that was just sent. Leaving it in the composer
   * would stamp an old instruction onto the next draft, so only a real success
   * clears it — a failure or an uncertain outcome keeps the user's only copy.
   */
  describe('draft note lifecycle', () => {
    it.each([
      ['delivered', { success: true }],
      ['staged', { success: true, mode: 'staged', stage: 'applied' }]
    ])('clears the note after a %s send', async (_case, response) => {
      const { result, onSendSucceeded } = setupWith({
        onSend: vi.fn(async () => response as unknown)
      })

      await act(async () => {
        await result.current.handleSend({ noteText: 'Explain this' })
      })

      expect(onSendSucceeded).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['failed', { success: false, error: 'paste_failed' }],
      ['uncertain', { success: false, error: 'autosend_failed_draft_saved' }],
      ['busy', { success: false, error: 'send_in_progress' }]
    ])('keeps the note when the send is %s', async (_case, response) => {
      const { result, onSendSucceeded } = setupWith({
        onSend: vi.fn(async () => response as unknown)
      })

      await act(async () => {
        await result.current.handleSend({ noteText: 'Explain this' })
      })

      expect(onSendSucceeded).not.toHaveBeenCalled()
    })
  })

  it('passes auto-send through when auto-send is on', async () => {
    const { result, onSend } = setup(true)

    await act(async () => {
      await result.current.handleSend()
    })

    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ autoSend: true }))
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
    const { result } = setupWith({
      onSend: vi.fn(async () => ({ success: true, mode: 'staged' }) as unknown),
      effectiveAutoSend: false
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.sendFeedback).toBe('idle')
    expect(result.current.lastError).toBeNull()
  })

  it('shows the error state and re-expands for a failed result', async () => {
    const { result, setIsExpanded } = setupWith({
      onSend: vi.fn(async () => ({ success: false, error: 'invalid_input' }) as unknown)
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.sendFeedback).toBe('error')
    expect(result.current.lastError).not.toBeNull()
    expect(setIsExpanded).toHaveBeenCalledWith(true)
  })

  // An exception is not proof that nothing happened. The send may have been
  // partially applied (source conversion, a pasted image, a transcript write),
  // so the outcome is `incomplete`: the user is told, and the automatic retry
  // stays closed. Assuming otherwise is how a duplicate message reaches the
  // target.
  it('treats a thrown send as an undecidable, non-repeatable outcome', async () => {
    const { result } = setupWith({
      onSend: (async () => {
        throw new Error('boom')
      }) as unknown as (payload: Payload) => Promise<unknown>
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.sendFeedback).toBe('incomplete')
    expect(result.current.isResendSafe).toBe(false)
    expect(result.current.lastError).not.toBeNull()
  })

  it('never re-runs the send intent after it threw', async () => {
    const onSend = vi.fn(async () => {
      throw new Error('boom')
    }) as unknown as (payload: Payload) => Promise<unknown>
    const { result } = setupWith({ onSend })

    await act(async () => {
      await result.current.handleSend({ noteText: 'Explain this' })
    })

    await act(async () => {
      result.current.handleRetry()
      result.current.handleRetry()
    })

    // İstisna, iş kısmen uygulandıktan sonra da oluşabilir: hedefe ikinci bir
    // mesaj bırakmamak için "Tekrar dene" sessizce kapanır.
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('ignores a send while another one is submitting', async () => {
    const onSend = vi.fn(async () => ({ success: true }) as unknown)
    const { result } = setupWith({ onSend, isSubmitting: true })

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
      const { result } = setupWith({ onSend })

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
      const { result } = setupWith({
        onSend: vi.fn(async () => ({ success: false, error: 'send_in_progress' }) as unknown)
      })

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
      const { result } = setupWith({ onSend })

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
      const { result, unmount } = setupWith({ onSend })

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
    it('retries with the payload the caller provides, not a stale one', async () => {
      const onSend = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockResolvedValueOnce({ success: false, error: 'paste_failed' })
        .mockResolvedValueOnce({ success: true })
      const { result } = setupWith({ onSend })

      await act(async () => {
        await result.current.handleSend({ noteText: 'Explain this', autoSend: true })
      })
      expect(result.current.sendFeedback).toBe('error')

      // Kullanıcı hata sonrası notu değiştirdi: düğme güncel talimatı gönderir.
      await act(async () => {
        result.current.handleRetry({ noteText: 'Explain this briefly', autoSend: false })
      })

      expect(onSend).toHaveBeenCalledTimes(2)
      expect(onSend.mock.calls[1][0]).toEqual({
        noteText: 'Explain this briefly',
        autoSend: false
      })
      // The successful retry is silent, like any other successful send.
      expect(result.current.sendFeedback).toBe('idle')
      expect(result.current.lastError).toBeNull()
    })

    it('falls back to the current note and auto-send when no payload is given', async () => {
      const onSend = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockResolvedValueOnce({ success: false, error: 'paste_failed' })
        .mockResolvedValueOnce({ success: true })
      const { result } = setupWith({ onSend, effectiveAutoSend: false })

      await act(async () => {
        await result.current.handleSend({ noteText: 'first attempt' })
      })
      await act(async () => {
        result.current.handleRetry()
      })

      // setupWith keeps noteText empty and auto-send off: the retry follows the
      // current fields, never a hidden earlier payload.
      expect(onSend.mock.calls[1][0]).toEqual({ noteText: undefined, autoSend: false })
    })

    it('never auto-resends when the content already reached the target', async () => {
      const onSend = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
      const { result } = setupWith({ onSend })

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

    it('hides the incomplete notice without unlocking sending or losing the draft', async () => {
      const onSend = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
      const { result } = setupWith({ onSend })

      await act(async () => {
        await result.current.handleSend({ noteText: 'Explain this' })
      })
      act(() => {
        result.current.dismissOutcome()
      })

      // Bildirim gizlendi…
      expect(result.current.isOutcomeDismissed).toBe(true)
      // …ama güvenlik durumu sıfırlanmadı: kısmi teslimat kilidi sürüyor.
      expect(result.current.sendFeedback).toBe('incomplete')
      expect(result.current.isResendSafe).toBe(false)
      // Not ve kuyruk bu hook'a bağlı değil; hiçbir temizleme çağrısı yapılmaz.
      expect(onSend).toHaveBeenCalledTimes(1)

      // Kuyruk boşaldığında açık bir sıfırlama kilidi bırakır.
      act(() => {
        result.current.resetOutcome()
      })
      expect(result.current.sendFeedback).toBe('idle')
      expect(result.current.isOutcomeDismissed).toBe(false)
    })
  })
})
