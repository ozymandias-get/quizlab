/**
 * Electron 44 removed the format-specific clipboard helpers (`readHTML`,
 * `readImage`, synchronous `writeText`, …) in favour of the W3C-shaped
 * `clipboard.read()` / `clipboard.write([new ClipboardItem(…)])` surface.
 *
 * These tests mock `electron` only — the adapter under test is the real one —
 * so the snapshot merge, the restore behaviour and the write queue are
 * exercised end to end instead of against a stub of the adapter itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  readClipboardSnapshot,
  writeClipboardImage,
  writeClipboardSnapshot,
  writeClipboardText
} from '../../../core/systemHandlers/clipboardApi.js'

// Hoisted with the mock factory so `FakeClipboardItem` is initialized before
// the adapter's `electron` import is resolved.
const { read, write, clear, FakeClipboardItem } = vi.hoisted(() => {
  class FakeClipboardItem {
    constructor(public readonly items: Record<string, Blob | string>) {}
  }

  return { read: vi.fn(), write: vi.fn(), clear: vi.fn(), FakeClipboardItem }
})

vi.mock('electron', () => ({
  clipboard: { read, write, clear },
  ClipboardItem: FakeClipboardItem
}))

interface ClipboardItemLike {
  types: string[]
  getType: (type: string) => Promise<Blob>
}

type FakeClipboardItemLike = InstanceType<typeof FakeClipboardItem>

function fakeItem(types: string[], values: Record<string, string>): ClipboardItemLike {
  return {
    types,
    getType: (type: string) => Promise.resolve(new Blob([values[type]], { type }))
  }
}

/** The `items` records of every `ClipboardItem` handed to `clipboard.write`. */
function writtenPayloads(): Record<string, Blob | string>[] {
  return write.mock.calls.flatMap((call: any[]) =>
    (call[0] as FakeClipboardItemLike[]).map((item) => item.items)
  )
}

async function blobText(value: Blob | string): Promise<string> {
  return typeof value === 'string' ? value : await value.text()
}

describe('systemHandlers/clipboardApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    read.mockResolvedValue([])
    write.mockResolvedValue(undefined)
    clear.mockReturnValue(undefined)
  })

  describe('readClipboardSnapshot', () => {
    it('returns text and html from a single item', async () => {
      read.mockResolvedValue([
        fakeItem(['text/plain', 'text/html'], {
          'text/plain': 'hello',
          'text/html': '<b>hello</b>'
        })
      ])

      const result = await readClipboardSnapshot()

      expect(result.text).toBe('hello')
      expect(result.html).toBe('<b>hello</b>')
      expect(result.image).toBeUndefined()
    })

    it('merges formats spread across separate items', async () => {
      read.mockResolvedValue([
        fakeItem(['image/png'], { 'image/png': 'x' }),
        fakeItem(['text/plain'], { 'text/plain': 'hello' })
      ])

      const result = await readClipboardSnapshot()

      expect(result.text).toBe('hello')
      expect(result.image).toEqual({ mimeType: 'image/png', bytes: Buffer.from('x') })
    })

    it('leaves absent formats undefined', async () => {
      read.mockResolvedValue([fakeItem(['image/png'], { 'image/png': 'x' })])

      const result = await readClipboardSnapshot()

      expect(result).toEqual({ image: { mimeType: 'image/png', bytes: Buffer.from('x') } })
      expect(result.text).toBeUndefined()
      expect(result.html).toBeUndefined()
    })

    it('returns an empty snapshot when read rejects', async () => {
      read.mockRejectedValue(new Error('clipboard unavailable'))

      await expect(readClipboardSnapshot()).resolves.toEqual({})
    })

    it('keeps other formats when one getType rejects', async () => {
      const item: ClipboardItemLike = {
        types: ['text/plain', 'text/html', 'image/png'],
        getType: (type: string) => {
          if (type === 'text/html') return Promise.reject(new Error('no html'))
          return Promise.resolve(new Blob([type === 'text/plain' ? 'hello' : 'x'], { type }))
        }
      }
      read.mockResolvedValue([item])

      const result = await readClipboardSnapshot()

      expect(result.text).toBe('hello')
      expect(result.image).toEqual({ mimeType: 'image/png', bytes: Buffer.from('x') })
      expect(result.html).toBeUndefined()
    })
  })

  describe('writeClipboardSnapshot', () => {
    it('writes only the image and never clears', async () => {
      const bytes = Buffer.from('img')

      await expect(
        writeClipboardSnapshot({ image: { mimeType: 'image/png', bytes } })
      ).resolves.toBe(true)

      expect(write).toHaveBeenCalledTimes(1)
      expect(clear).not.toHaveBeenCalled()
      const [payload] = writtenPayloads()
      expect(Object.keys(payload)).toEqual(['image/png'])
      expect(await blobText(payload['image/png'])).toBe('img')
    })

    it('writes html and text as a single item', async () => {
      await writeClipboardSnapshot({ html: '<b>hi</b>', text: 'hi' })

      expect(write).toHaveBeenCalledTimes(1)
      expect(Object.keys(writtenPayloads()[0])).toEqual(['text/html', 'text/plain'])
    })

    it('prefers image over html and text', async () => {
      await writeClipboardSnapshot({
        image: { mimeType: 'image/png', bytes: Buffer.from('img') },
        html: '<b>hi</b>',
        text: 'hi'
      })

      expect(write).toHaveBeenCalledTimes(1)
      expect(Object.keys(writtenPayloads()[0])).toEqual(['image/png'])
    })

    it('derives a text/plain flavour from html when text is missing', async () => {
      await writeClipboardSnapshot({ html: '<b>hi</b>' })

      const [payload] = writtenPayloads()
      expect(await blobText(payload['text/plain'])).toBe('hi')
    })

    it('writes text without an html flavour', async () => {
      await writeClipboardSnapshot({ text: 'plain only' })

      const [payload] = writtenPayloads()
      expect(Object.keys(payload)).toEqual(['text/plain'])
      expect(await blobText(payload['text/plain'])).toBe('plain only')
    })

    it('clears instead of writing when there is nothing to restore', async () => {
      await expect(writeClipboardSnapshot({})).resolves.toBe(true)

      expect(clear).toHaveBeenCalledTimes(1)
      expect(write).not.toHaveBeenCalled()
    })

    it('resolves false when write rejects', async () => {
      write.mockRejectedValueOnce(new Error('clipboard locked'))

      await expect(writeClipboardSnapshot({ text: 'hi' })).resolves.toBe(false)
    })
  })

  describe('writeClipboardText / writeClipboardImage', () => {
    it('writes text as a single item', async () => {
      await writeClipboardText('hello')

      expect(write).toHaveBeenCalledTimes(1)
      expect(Object.keys(writtenPayloads()[0])).toEqual(['text/plain'])
      expect(await blobText(writtenPayloads()[0]['text/plain'])).toBe('hello')
    })

    it('writes an image as a single item', async () => {
      await writeClipboardImage({ mimeType: 'image/png', bytes: Buffer.from('img') })

      expect(write).toHaveBeenCalledTimes(1)
      expect(Object.keys(writtenPayloads()[0])).toEqual(['image/png'])
      expect(await blobText(writtenPayloads()[0]['image/png'])).toBe('img')
    })

    it('keeps serving the write queue after a rejected write', async () => {
      write.mockRejectedValueOnce(new Error('clipboard locked'))

      await expect(writeClipboardText('a')).rejects.toThrow('clipboard locked')
      await expect(writeClipboardText('b')).resolves.toBeUndefined()

      expect(write).toHaveBeenCalledTimes(2)
      expect(await blobText(writtenPayloads()[1]['text/plain'])).toBe('b')
    })

    it('does not start a second write until the first has settled', async () => {
      let releaseFirst = (): void => {}
      write.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve
          })
      )

      const first = writeClipboardText('a')
      const second = writeClipboardText('b')

      // The second write must still be queued behind the first, which is only
      // observable because `clipboard.write` is still pending.
      await Promise.resolve()
      expect(write).toHaveBeenCalledTimes(1)

      releaseFirst()
      await Promise.all([first, second])

      expect(write).toHaveBeenCalledTimes(2)
      const written = await Promise.all(
        writtenPayloads().map((payload) => blobText(payload['text/plain']))
      )
      expect(written).toEqual(['a', 'b'])
    })
  })
})
