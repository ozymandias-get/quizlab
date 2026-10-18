import { isDeliveredSendResult, isStagedSendResult } from '@features/ai/lib/sendUtils'

import { describe, expect, it } from 'vitest'

/**
 * Auto-send off must never be reported as a delivery. The pipeline returns
 * `success: true` for a staged turn (the image is in the site's composer and the
 * prompt is typed), so only the mode distinguishes the two.
 */
describe('isStagedSendResult', () => {
  it.each(['staged', 'paste_only', 'paste_and_prompt'])('treats %s as staged', (mode) => {
    expect(isStagedSendResult({ success: true, mode })).toBe(true)
  })

  it.each(['auto_click', 'auto_click_with_prompt', 'click', 'enter_key', 'mixed'])(
    'does not treat %s as staged',
    (mode) => {
      expect(isStagedSendResult({ success: true, mode })).toBe(false)
    }
  )

  it('does not treat a result without a mode as staged', () => {
    expect(isStagedSendResult({ success: true })).toBe(false)
    expect(isStagedSendResult({ success: true, mode: '' })).toBe(false)
  })

  it('never treats a failure as staged', () => {
    expect(isStagedSendResult({ success: false, mode: 'paste_only' })).toBe(false)
  })

  // Submit modes vary per platform and gain new values over time. Anything not
  // explicitly staged must count as delivered so a real send is never mislabelled.
  it('treats an unknown successful mode as delivered', () => {
    expect(isStagedSendResult({ success: true, mode: 'some_future_mode' })).toBe(false)
  })
})

describe('isDeliveredSendResult', () => {
  it('is false for a failure regardless of mode', () => {
    expect(isDeliveredSendResult({ success: false })).toBe(false)
    expect(isDeliveredSendResult({ success: false, mode: 'auto_click' })).toBe(false)
  })

  // The two predicates must partition every successful outcome exactly: a
  // send is either staged or delivered, never both and never neither.
  it('agrees with isStagedSendResult for every successful outcome', () => {
    const cases = [
      { success: true },
      { success: true, mode: '' },
      { success: true, mode: 'staged' },
      { success: true, mode: 'paste_only' },
      { success: true, mode: 'paste_and_prompt' },
      { success: true, mode: 'auto_click' },
      { success: true, mode: 'click' },
      { success: true, mode: 'enter_key' },
      { success: true, mode: 'mixed' }
    ]
    for (const c of cases) {
      expect(isDeliveredSendResult(c)).toBe(!isStagedSendResult(c))
    }
  })

  // A failure is neither delivered nor staged, so the negation does not hold.
  it('reports a failure as neither delivered nor staged', () => {
    expect(isDeliveredSendResult({ success: false, mode: 'paste_only' })).toBe(false)
    expect(isStagedSendResult({ success: false, mode: 'paste_only' })).toBe(false)
  })
})
