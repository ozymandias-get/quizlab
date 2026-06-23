import {
  classifyAutomationError,
  errorCategoryOf,
  isRetryable,
  normalizeErrorCode,
  shouldRequestRepick
} from '@electron/features/automation/automationScripts/lib/errorClassifier'

import { describe, expect, it } from 'vitest'

describe('errorClassifier', () => {
  describe('normalizeErrorCode', () => {
    it('returns trimmed string for valid string codes', () => {
      expect(normalizeErrorCode('  input_not_found  ')).toBe('input_not_found')
    })

    it('collapses framework noise to unknown', () => {
      expect(normalizeErrorCode('Illegal invocation')).toBe('unknown')
      expect(normalizeErrorCode('')).toBe('unknown')
      expect(normalizeErrorCode('   ')).toBe('unknown')
    })

    it('coerces numbers and rejects everything else', () => {
      expect(normalizeErrorCode(500)).toBe('500')
      expect(normalizeErrorCode(null)).toBe('unknown')
      expect(normalizeErrorCode(undefined)).toBe('unknown')
      expect(normalizeErrorCode({})).toBe('unknown')
      expect(normalizeErrorCode([])).toBe('unknown')
    })
  })

  describe('classifyAutomationError - selector category', () => {
    it('classifies input_not_found as selector / after-repick / user-actionable', () => {
      const c = classifyAutomationError('input_not_found')
      expect(c.category).toBe('selector')
      expect(c.retry).toBe('after-repick')
      expect(c.isUserActionable).toBe(true)
      expect(c.toastKey).toBe('toast_input_not_found')
    })

    it('classifies button_not_found as selector / after-repick', () => {
      const c = classifyAutomationError('button_not_found')
      expect(c.category).toBe('selector')
      expect(c.retry).toBe('after-repick')
    })

    it('classifies selector_repick_required as selector / never (user must act)', () => {
      const c = classifyAutomationError('selector_repick_required')
      expect(c.category).toBe('selector')
      expect(c.retry).toBe('never')
      expect(c.isUserActionable).toBe(true)
    })

    it('classifies ambiguous_match as selector / after-repick', () => {
      const c = classifyAutomationError('ambiguous_match')
      expect(c.category).toBe('selector')
      expect(c.retry).toBe('after-repick')
    })
  })

  describe('classifyAutomationError - submit / paste / upload', () => {
    it('classifies submit_not_ready as submit / different-strategy / triggerFallback', () => {
      const c = classifyAutomationError('submit_not_ready')
      expect(c.category).toBe('submit')
      expect(c.retry).toBe('different-strategy')
      expect(c.triggerFallback).toBe(true)
    })

    it('classifies submit_failed as submit / same-strategy / triggerFallback', () => {
      const c = classifyAutomationError('submit_failed')
      expect(c.category).toBe('submit')
      expect(c.retry).toBe('same-strategy')
      expect(c.triggerFallback).toBe(true)
    })

    it('classifies paste_failed as paste / different-strategy', () => {
      const c = classifyAutomationError('paste_failed')
      expect(c.category).toBe('paste')
      expect(c.retry).toBe('different-strategy')
      expect(c.triggerFallback).toBe(true)
    })

    it('classifies upload_failed as upload / different-strategy', () => {
      const c = classifyAutomationError('upload_failed')
      expect(c.category).toBe('upload')
      expect(c.retry).toBe('different-strategy')
    })

    it('classifies upload_timed_out as upload / after-backoff', () => {
      const c = classifyAutomationError('upload_timed_out')
      expect(c.category).toBe('upload')
      expect(c.retry).toBe('after-backoff')
    })

    it('classifies clipboard_failed as clipboard / after-backoff', () => {
      const c = classifyAutomationError('clipboard_failed')
      expect(c.category).toBe('clipboard')
      expect(c.retry).toBe('after-backoff')
    })

    it('classifies autosend_failed_draft_saved as submit / never (no auto-retry)', () => {
      const c = classifyAutomationError('autosend_failed_draft_saved')
      expect(c.category).toBe('submit')
      expect(c.retry).toBe('never')
    })
  })

  describe('classifyAutomationError - network / timeout', () => {
    it('classifies network_error as network / after-backoff', () => {
      const c = classifyAutomationError('network_error')
      expect(c.category).toBe('network')
      expect(c.retry).toBe('after-backoff')
    })

    it('classifies timed_out as timeout / same-strategy', () => {
      const c = classifyAutomationError('timed_out')
      expect(c.category).toBe('timeout')
      expect(c.retry).toBe('same-strategy')
    })

    it('catches any "timeout" or "timed_out" substring as timeout category', () => {
      expect(classifyAutomationError('image_upload_timed_out').category).toBe('timeout')
      expect(classifyAutomationError('click_send_timeout').category).toBe('timeout')
      expect(classifyAutomationError('paste_timed_out').category).toBe('timeout')
    })
  })

  describe('classifyAutomationError - webview / permission / site / config', () => {
    it('classifies webview_destroyed as webview / never', () => {
      const c = classifyAutomationError('webview_destroyed')
      expect(c.category).toBe('webview')
      expect(c.retry).toBe('never')
    })

    it('classifies auth_required as permission / never / user-actionable', () => {
      const c = classifyAutomationError('auth_required')
      expect(c.category).toBe('permission')
      expect(c.retry).toBe('never')
      expect(c.isUserActionable).toBe(true)
    })

    it('classifies wrong_url as site / never', () => {
      const c = classifyAutomationError('wrong_url')
      expect(c.category).toBe('site')
      expect(c.retry).toBe('never')
    })

    it('classifies config_not_found as config / never', () => {
      const c = classifyAutomationError('config_not_found')
      expect(c.category).toBe('config')
      expect(c.retry).toBe('never')
    })

    it('classifies empty_text as config / never', () => {
      const c = classifyAutomationError('empty_text')
      expect(c.category).toBe('config')
      expect(c.retry).toBe('never')
    })
  })

  describe('classifyAutomationError - unknown', () => {
    it('falls back to unknown / same-strategy / triggerFallback for unrecognized codes', () => {
      const c = classifyAutomationError('mystery_failure_xyz')
      expect(c.category).toBe('unknown')
      expect(c.retry).toBe('same-strategy')
      expect(c.triggerFallback).toBe(true)
      expect(c.toastKey).toBe('toast_automation_failed')
    })

    it('handles non-string error inputs without throwing', () => {
      const c = classifyAutomationError(undefined)
      expect(c.code).toBe('unknown')
      expect(c.category).toBe('unknown')
    })
  })

  describe('helpers', () => {
    it('shouldRequestRepick returns true for after-repick errors only', () => {
      expect(shouldRequestRepick('input_not_found')).toBe(true)
      expect(shouldRequestRepick('button_not_found')).toBe(true)
      expect(shouldRequestRepick('ambiguous_match')).toBe(true)
      expect(shouldRequestRepick('submit_failed')).toBe(false)
      expect(shouldRequestRepick('submit_not_ready')).toBe(false)
      expect(shouldRequestRepick('selector_repick_required')).toBe(false) // 'never'
    })

    it('isRetryable excludes never and after-repick', () => {
      expect(isRetryable('submit_failed')).toBe(true) // same-strategy
      expect(isRetryable('submit_not_ready')).toBe(true) // different-strategy
      expect(isRetryable('clipboard_failed')).toBe(true) // after-backoff
      expect(isRetryable('input_not_found')).toBe(false) // after-repick
      expect(isRetryable('webview_destroyed')).toBe(false) // never
      expect(isRetryable('mystery_xyz')).toBe(true) // unknown → same-strategy
    })

    it('errorCategoryOf returns just the category for log/metric use', () => {
      expect(errorCategoryOf('input_not_found')).toBe('selector')
      expect(errorCategoryOf('paste_failed')).toBe('paste')
      expect(errorCategoryOf('totally_random')).toBe('unknown')
    })
  })
})
