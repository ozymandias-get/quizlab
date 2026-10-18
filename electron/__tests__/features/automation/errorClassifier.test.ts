import {
  classifyAutomationError,
  errorCategoryOf,
  isRetryable,
  normalizeErrorCode,
  shouldRequestRepick
} from '../../../../shared/lib/errorClassifier.js'

import { describe, expect, it } from 'vitest'

/**
 * `shared/lib/errorClassifier.ts` saf bir tablodur: her hata kodu tek bir
 * karara (category / retry / triggerFallback) eşlenir. Bu dosya tablodaki her
 * satırı TEK yerde toplar; yeni bir kod eklediğinde beklenti buraya girilir,
 * tablo ile davranış böylece kilitlenir.
 */
describe('errorClassifier', () => {
  interface Row {
    code: string
    category: string
    retry: string
    triggerFallback: boolean
    isUserActionable?: boolean
    toastKey?: string
  }

  const TABLE: Row[] = [
    // selector
    {
      code: 'input_not_found',
      category: 'selector',
      retry: 'after-repick',
      triggerFallback: false,
      isUserActionable: true,
      toastKey: 'toast_input_not_found'
    },
    {
      code: 'button_not_found',
      category: 'selector',
      retry: 'after-repick',
      triggerFallback: false
    },
    {
      code: 'selector_repick_required',
      category: 'selector',
      retry: 'never',
      triggerFallback: false,
      isUserActionable: true
    },
    {
      code: 'ambiguous_match',
      category: 'selector',
      retry: 'after-repick',
      triggerFallback: false
    },
    // submit
    {
      code: 'submit_not_ready',
      category: 'submit',
      retry: 'different-strategy',
      triggerFallback: true
    },
    {
      code: 'submit_failed',
      category: 'submit',
      retry: 'same-strategy',
      triggerFallback: true
    },
    {
      code: 'autosend_failed_draft_saved',
      category: 'submit',
      retry: 'never',
      triggerFallback: false
    },
    // paste / upload / clipboard
    { code: 'paste_failed', category: 'paste', retry: 'different-strategy', triggerFallback: true },
    {
      code: 'upload_failed',
      category: 'upload',
      retry: 'different-strategy',
      triggerFallback: true
    },
    {
      code: 'upload_timed_out',
      category: 'upload',
      retry: 'after-backoff',
      triggerFallback: false
    },
    {
      code: 'clipboard_failed',
      category: 'clipboard',
      retry: 'after-backoff',
      triggerFallback: false
    },
    // network / timeout
    { code: 'network_error', category: 'network', retry: 'after-backoff', triggerFallback: false },
    { code: 'timed_out', category: 'timeout', retry: 'same-strategy', triggerFallback: false },
    // Jenerik `(timeout|timed_out)` alt dize eşleşmesi.
    {
      code: 'image_upload_timed_out',
      category: 'timeout',
      retry: 'same-strategy',
      triggerFallback: false
    },
    {
      code: 'click_send_timeout',
      category: 'timeout',
      retry: 'same-strategy',
      triggerFallback: false
    },
    {
      code: 'paste_timed_out',
      category: 'timeout',
      retry: 'same-strategy',
      triggerFallback: false
    },
    // webview / permission / site / config
    { code: 'webview_destroyed', category: 'webview', retry: 'never', triggerFallback: false },
    {
      code: 'auth_required',
      category: 'permission',
      retry: 'never',
      triggerFallback: false,
      isUserActionable: true
    },
    { code: 'wrong_url', category: 'site', retry: 'never', triggerFallback: false },
    { code: 'config_not_found', category: 'config', retry: 'never', triggerFallback: false },
    { code: 'empty_text', category: 'config', retry: 'never', triggerFallback: false },
    // Bilinmeyen kod → unknown fallback.
    {
      code: 'mystery_failure_xyz',
      category: 'unknown',
      retry: 'same-strategy',
      triggerFallback: true,
      toastKey: 'toast_automation_failed'
    }
  ]

  it('maps every ERROR_TABLE code to its category / retry / fallback decision', () => {
    for (const row of TABLE) {
      const classified = classifyAutomationError(row.code)
      expect(
        { code: row.code, category: classified.category, retry: classified.retry },
        `ERROR_TABLE row drifted for ${row.code}`
      ).toEqual({ code: row.code, category: row.category, retry: row.retry })
      expect(classified.triggerFallback, `triggerFallback drifted for ${row.code}`).toBe(
        row.triggerFallback
      )
      if (row.isUserActionable !== undefined) {
        expect(classified.isUserActionable, `isUserActionable drifted for ${row.code}`).toBe(
          row.isUserActionable
        )
      }
      if (row.toastKey) {
        expect(classified.toastKey, `toastKey drifted for ${row.code}`).toBe(row.toastKey)
      }
    }

    // Non-string error inputs must not throw.
    const undefinedCode = classifyAutomationError(undefined).code
    expect(undefinedCode).toBe('unknown')
  })

  it('normalizes codes, framework noise and non-strings', () => {
    expect(normalizeErrorCode('  input_not_found  ')).toBe('input_not_found')
    expect(normalizeErrorCode(500)).toBe('500')
    for (const raw of ['Illegal invocation', '', '   ', null, undefined, {}, []]) {
      expect(normalizeErrorCode(raw)).toBe('unknown')
    }
  })

  it('derives shouldRequestRepick / isRetryable / errorCategoryOf consistently', () => {
    expect(shouldRequestRepick('input_not_found')).toBe(true)
    expect(shouldRequestRepick('button_not_found')).toBe(true)
    expect(shouldRequestRepick('ambiguous_match')).toBe(true)
    expect(shouldRequestRepick('submit_failed')).toBe(false)
    expect(shouldRequestRepick('submit_not_ready')).toBe(false)
    expect(shouldRequestRepick('selector_repick_required')).toBe(false) // 'never'

    expect(isRetryable('submit_failed')).toBe(true) // same-strategy
    expect(isRetryable('submit_not_ready')).toBe(true) // different-strategy
    expect(isRetryable('clipboard_failed')).toBe(true) // after-backoff
    expect(isRetryable('input_not_found')).toBe(false) // after-repick
    expect(isRetryable('webview_destroyed')).toBe(false) // never
    expect(isRetryable('mystery_xyz')).toBe(true) // unknown → same-strategy

    expect(errorCategoryOf('input_not_found')).toBe('selector')
    expect(errorCategoryOf('paste_failed')).toBe('paste')
    expect(errorCategoryOf('totally_random')).toBe('unknown')
  })
})
