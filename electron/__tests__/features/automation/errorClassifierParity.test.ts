import { errorClassifierRuntime } from '@electron/features/automation/automationScripts/lib/errorClassifierRuntime'

import {
  classifyAutomationError,
  normalizeErrorCode
} from '../../../../shared/lib/errorClassifier.js'

import { describe, expect, it } from 'vitest'

/**
 * Kanonik sınıflandırıcı (`shared/lib/errorClassifier.ts`) ile guest-page
 * runtime kopyası (`errorClassifierRuntime` string template'i) arasındaki
 * davranış eşleşmesi.
 *
 * İki implementasyon farklı ortamlarda çalışır (host TS modülü vs. enjekte
 * edilen ES5 string), ancak karar verilen beş alan — code, category, retry,
 * triggerFallback, toastKey — her girdide aynı olmalıdır.
 *
 * BİLİNÇLİ FARKLILIKLAR (eşitsizlik değil, tasarım kararı):
 * - `description` ve `isUserActionable` yalnızca host'tadır; guest toast
 *   göstermez, yalnızca retry/fallback kararı üretir.
 * - Host `isRetryable()` (boolean politika), guest `__retryBudgetFor()`
 *   (sayısal bütçe 0/1/2) sunar; ikisi de aynı `retry` stratejisinden türer.
 */
describe('error classifier parity (host vs guest runtime)', () => {
  const harness = `() => {
    ${errorClassifierRuntime}
    return {
      classify: __classifyError,
      normalize: __normalizeErrorCode
    }
  }`

  interface GuestClassification {
    code: string
    retry: string
    triggerFallback: boolean
    category: string
    toastKey: string
  }

  function guest(raw: unknown): GuestClassification {
    const helpers = (window.eval(harness) as () => unknown)() as {
      classify: (input: unknown) => GuestClassification
    }
    return helpers.classify(raw)
  }

  function guestNormalize(raw: unknown): string {
    const helpers = (window.eval(harness) as () => unknown)() as {
      normalize: (input: unknown) => string
    }
    return helpers.normalize(raw)
  }

  // Kanonik ERROR_TABLE'daki her satır + fallback + jenerik eşleşmeler.
  const codes: unknown[] = [
    'input_not_found',
    'button_not_found',
    'selector_repick_required',
    'ambiguous_match',
    'submit_not_ready',
    'submit_failed',
    'autosend_failed_draft_saved',
    'click_failed',
    'paste_failed',
    'clipboard_failed',
    'upload_failed',
    'upload_timed_out',
    'paste_not_applied',
    'network_error',
    'timed_out',
    'webview_destroyed',
    'webview_not_ready',
    'webview_api_missing',
    'wrong_url',
    'auth_required',
    'config_not_found',
    'registry_not_loaded',
    'empty_text',
    'invalid_input',
    'invalid_image_format',
    'cancelled',
    // Tablo dışı → unknown fallback (retryable + fallback tetikler).
    'something_random',
    // Jenerik timeout regex'i.
    'image_upload_timed_out',
    'click_send_timeout',
    // Framework gürültüsü → unknown kodu.
    'Illegal invocation',
    ''
  ]

  it.each(codes)('classify(%j) host ile aynı kararı üretir', (raw) => {
    const host = classifyAutomationError(raw)
    const result = guest(raw)
    expect(result.code).toBe(host.code)
    expect(result.category).toBe(host.category)
    expect(result.retry).toBe(host.retry)
    expect(result.triggerFallback).toBe(host.triggerFallback)
    expect(result.toastKey).toBe(host.toastKey)
  })

  it.each([500, 0, '  timed_out  ', null, undefined])(
    'normalize(%j) host ile aynı kodu üretir',
    (raw) => {
      expect(guestNormalize(raw)).toBe(normalizeErrorCode(raw))
    }
  )

  it('yalnızca beş satır fallback tetikler (submit_not_ready, submit_failed, paste_failed, upload_failed, paste_not_applied) + unknown', () => {
    const fallbackCodes = codes.filter((c) => guest(c).triggerFallback)
    expect(fallbackCodes).toEqual(
      expect.arrayContaining([
        'submit_not_ready',
        'submit_failed',
        'paste_failed',
        'upload_failed',
        'paste_not_applied',
        'something_random'
      ])
    )
    // Transient ama fallback gerektirmeyenler özellikle false kalmalı.
    for (const code of ['clipboard_failed', 'upload_timed_out', 'network_error', 'timed_out']) {
      expect(guest(code).triggerFallback).toBe(false)
    }
  })
})
