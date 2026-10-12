/**
 * `resolveDraftSendIntent` is the single place that decides what the send
 * button *says* — and it is shared by two buttons: the one in the open panel
 * and the one on the collapsed pill. If the two could disagree, the user would
 * see "Sent" on one and "Prepare" on the other for the same queue.
 *
 * The honesty rule lives here: with auto-send off the button says "prepare",
 * never "send", because nothing is delivered yet.
 */
import { resolveDraftSendIntent } from '@app/ui/aiSendComposer/draftSendIntent'

import { describe, expect, it } from 'vitest'

describe('resolveDraftSendIntent', () => {
  it('says prepare when auto-send is off', () => {
    expect(resolveDraftSendIntent({ autoSend: false, feedback: 'idle', isSubmitting: false })).toBe(
      'prepare'
    )
    expect(
      resolveDraftSendIntent({ autoSend: false, feedback: 'staged', isSubmitting: false })
    ).toBe('prepare')
  })

  it('says send when auto-send is on', () => {
    expect(resolveDraftSendIntent({ autoSend: true, feedback: 'idle', isSubmitting: false })).toBe(
      'send'
    )
  })

  it('keeps the mode as the label after staging', () => {
    // `staged` means "placed in the AI box", not "delivered". The button label
    // describes what a *click* would do, so staging must not change it: with
    // auto-send off, a click still only prepares.
    expect(
      resolveDraftSendIntent({ autoSend: false, feedback: 'staged', isSubmitting: false })
    ).toBe('prepare')
    // With auto-send on, a click does send — so the action label stays "send".
    // The honesty rule lives in the status line, which reports `staged` rather
    // than "Gönderildi"; that is asserted where the status is rendered.
    expect(
      resolveDraftSendIntent({ autoSend: true, feedback: 'staged', isSubmitting: false })
    ).toBe('send')
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
