/**
 * Regression tests for the markdown block renderer.
 *
 * React keys must be unique across the whole message. `renderContent` splits a
 * message into prose segments separated by fenced code blocks and restarted the
 * line index at 0 for each segment, so any message with two or more code blocks
 * emitted the same `l-<n>` keys twice.
 */
import { renderContent } from '@features/ai/lib/parseMessageContentRender'

import { describe, expect, it } from 'vitest'

function collectKeys(nodes: ReturnType<typeof renderContent>): string[] {
  const keys: string[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object' && 'key' in node) {
      const key = (node as { key: unknown }).key
      if (key !== null && key !== undefined) keys.push(String(key))
    }
  }
  walk(nodes)
  return keys
}

describe('renderContent block keys', () => {
  it('emits unique keys for a message with several code blocks', () => {
    const message = [
      'Intro paragraph.',
      '',
      '```ts',
      'const a = 1',
      '```',
      '',
      'Middle paragraph.',
      'Second middle line.',
      '',
      '```py',
      'print("b")',
      '```',
      '',
      'Outro paragraph.'
    ].join('\n')

    const keys = collectKeys(renderContent(message))

    expect(keys.length).toBeGreaterThan(4)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('emits unique keys when tables appear in more than one segment', () => {
    const message = [
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```js',
      'const x = 1',
      '```',
      '',
      '| c | d |',
      '| --- | --- |',
      '| 3 | 4 |'
    ].join('\n')

    const keys = collectKeys(renderContent(message))

    expect(keys.filter((k) => k.startsWith('tbl-')).length).toBe(2)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps producing keys for a single code block', () => {
    const keys = collectKeys(renderContent('Before\n\n```\nx\n```\n\nAfter'))

    expect(keys.filter((k) => k.startsWith('c-'))).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('returns a single key namespace for a long message without code blocks', () => {
    const keys = collectKeys(
      renderContent(Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n'))
    )

    expect(keys).toHaveLength(50)
    expect(new Set(keys).size).toBe(50)
  })
})
