/**
 * `resolveDraftSendIntent` is the single place that decides what the send
 * button *says* — and it is shared by two buttons: the one in the open panel
 * and the one on the collapsed pill. If the two could disagree, the user would
 * see "Sent" on one and "Prepare" on the other for the same queue.
 *
 * The honesty rule lives here: with auto-send off the button says "prepare",
 * never "send", because nothing is delivered yet.
 *
 * Success has no feedback state of its own any more — a delivered or staged
 * send returns the composer to `idle` — so the post-send label is the `idle`
 * case above, and it still describes what a *click* would do.
 */
import { resolveDraftSendIntent } from '@app/ui/aiSendComposer/draftSendIntent'

import { describe, expect, it } from 'vitest'

describe('resolveDraftSendIntent', () => {
  it('says prepare when auto-send is off', () => {
    expect(resolveDraftSendIntent({ autoSend: false, feedback: 'idle', isSubmitting: false })).toBe(
      'prepare'
    )
  })

  it('says send when auto-send is on', () => {
    expect(resolveDraftSendIntent({ autoSend: true, feedback: 'idle', isSubmitting: false })).toBe(
      'send'
    )
  })

  it('reports an in-flight submit as sending, whichever flag carried it', () => {
    expect(
      resolveDraftSendIntent({ autoSend: false, feedback: 'sending', isSubmitting: false })
    ).toBe('sending')
    expect(resolveDraftSendIntent({ autoSend: false, feedback: 'idle', isSubmitting: true })).toBe(
      'sending'
    )
  })

  it('offers a retry after an error regardless of the mode', () => {
    expect(resolveDraftSendIntent({ autoSend: true, feedback: 'error', isSubmitting: false })).toBe(
      'retry'
    )
    expect(
      resolveDraftSendIntent({ autoSend: false, feedback: 'error', isSubmitting: false })
    ).toBe('retry')
  })
})
