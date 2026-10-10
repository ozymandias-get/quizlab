import { describe, expect, it } from 'vitest'

import {
  registerDomSlot,
  resolveDomSlot,
  subscribeDomSlot,
  unregisterDomSlot
} from '../../../shared/lib/domSlot'

function makeSlot(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('domSlot registry', () => {
  it('resolves null when nothing is registered', () => {
    expect(resolveDomSlot('test-empty')).toBeNull()
  })

  it('resolves the most recently registered slot', () => {
    const first = makeSlot()
    const second = makeSlot()
    registerDomSlot('test-latest', first)
    registerDomSlot('test-latest', second)

    expect(resolveDomSlot('test-latest')).toBe(second)
  })

  it('is idempotent for the same element', () => {
    const slot = makeSlot()
    registerDomSlot('test-idempotent', slot)
    registerDomSlot('test-idempotent', slot)

    expect(resolveDomSlot('test-idempotent')).toBe(slot)
    unregisterDomSlot('test-idempotent', slot)
    expect(resolveDomSlot('test-idempotent')).toBeNull()
  })

  it('falls back to a surviving slot when the newest unmounts', () => {
    const first = makeSlot()
    const second = makeSlot()
    registerDomSlot('test-survivor', first)
    registerDomSlot('test-survivor', second)

    unregisterDomSlot('test-survivor', second)

    expect(resolveDomSlot('test-survivor')).toBe(first)
  })

  it('ignores a detached slot and reports the next live one', () => {
    const first = makeSlot()
    const second = makeSlot()
    registerDomSlot('test-detached', first)
    registerDomSlot('test-detached', second)
    second.remove()

    expect(resolveDomSlot('test-detached')).toBe(first)
  })

  it('notifies subscribers on register and unregister', () => {
    const seen: (HTMLElement | null)[] = []
    const unsubscribe = subscribeDomSlot('test-subscribe', (el) => seen.push(el))

    expect(seen).toEqual([null])

    const slot = makeSlot()
    registerDomSlot('test-subscribe', slot)
    expect(seen.at(-1)).toBe(slot)

    unregisterDomSlot('test-subscribe', slot)
    expect(seen.at(-1)).toBeNull()

    unsubscribe()
  })

  it('stops notifying after unsubscribe', () => {
    const seen: (HTMLElement | null)[] = []
    const unsubscribe = subscribeDomSlot('test-unsubscribe', (el) => seen.push(el))
    unsubscribe()

    registerDomSlot('test-unsubscribe', makeSlot())

    expect(seen).toEqual([null])
  })
})
