import type { AiViewEvent } from '@shared-core/types/aiView'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const onEvent = vi.hoisted(() => vi.fn())
const electronApi = vi.hoisted(() => ({ aiView: { onEvent } }))

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: () => electronApi
}))

const { subscribeAiViewEvents } = await import('@shared/hooks/aiContent/aiViewClient')

const makeEvent = (viewId: string): AiViewEvent => ({
  viewId,
  generation: 1,
  kind: 'did-navigate',
  url: 'https://chatgpt.com/a',
  isMainFrame: true
})

/**
 * The fan-in is module scoped on purpose, so each test releases everything it
 * opened and reads the handler from the most recent bridge subscription.
 */
const subscriptions: Array<() => void> = []
const subscribe = (handler: (event: AiViewEvent) => void) => {
  subscriptions.push(subscribeAiViewEvents(handler))
  const calls = onEvent.mock.calls
  const [bridgeHandler] = calls[calls.length - 1] as [(event: AiViewEvent) => void]
  return { unsubscribe: subscriptions.at(-1)!, bridgeHandler }
}

describe('subscribeAiViewEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onEvent.mockImplementation(() => () => {})
  })

  afterEach(() => {
    while (subscriptions.length > 0) subscriptions.pop()?.()
  })

  it('subscribes to the bridge exactly once for many subscribers', () => {
    const a = subscribe(vi.fn())
    subscribe(vi.fn())

    expect(onEvent).toHaveBeenCalledTimes(1)

    a.unsubscribe()
    // The second subscriber is still listening, so the shared subscription lives.
    expect(onEvent).toHaveBeenCalledTimes(1)
  })

  it('fans one bridge event out to every subscriber', () => {
    const onA = vi.fn()
    const onB = vi.fn()
    const { bridgeHandler } = subscribe(onA)
    subscribe(onB)

    bridgeHandler(makeEvent('tab-1'))

    expect(onA).toHaveBeenCalledTimes(1)
    expect(onB).toHaveBeenCalledTimes(1)
  })

  it('keeps dispatching after a subscriber throws', () => {
    const onHealthy = vi.fn()
    const { bridgeHandler } = subscribe(() => {
      throw new Error('subscriber blew up')
    })
    subscribe(onHealthy)

    expect(() => bridgeHandler(makeEvent('tab-1'))).not.toThrow()
    expect(onHealthy).toHaveBeenCalledTimes(1)
  })

  it('re-subscribes after every subscriber has gone', () => {
    const first = subscribe(vi.fn())
    first.unsubscribe()
    expect(onEvent).toHaveBeenCalledTimes(1)

    const second = subscribe(vi.fn())
    second.bridgeHandler(makeEvent('tab-1'))
    expect(onEvent).toHaveBeenCalledTimes(2)
  })
})
