import { describe, expect, it } from 'vitest'

import { isReloadShortcut } from '../../app/reloadShortcut.js'

function input(overrides: Partial<Parameters<typeof isReloadShortcut>[0]> = {}) {
  return { type: 'keyDown', key: 'r', control: false, meta: false, ...overrides }
}

describe('the keyboard reload shortcuts', () => {
  it.each([
    ['Ctrl+R', input({ control: true })],
    ['Cmd+R', input({ meta: true })],
    ['F5', input({ key: 'F5' })]
  ])('recognises %s', (_label, event) => {
    expect(isReloadShortcut(event)).toBe(true)
  })

  it('ignores a keyup so one press starts one flush', () => {
    expect(isReloadShortcut(input({ type: 'keyUp', control: true }))).toBe(false)
  })

  it('ignores typing r and other shortcuts', () => {
    expect(isReloadShortcut(input({ key: 'r' }))).toBe(false)
    expect(isReloadShortcut(input({ key: 's', control: true }))).toBe(false)
  })
})
