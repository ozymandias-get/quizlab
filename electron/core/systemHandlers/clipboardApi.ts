/**
 * The single owner of all contact with Electron's clipboard.
 *
 * Electron 44 dropped the format-specific helpers (`readHTML`, `readImage`,
 * synchronous `writeText`, …) and made `readText`/`writeText` asynchronous.
 * Every main-process read and write goes through the W3C-shaped
 * `clipboard.read()` / `clipboard.write([new ClipboardItem(…)])` surface here,
 * so the migration stays contained in this one module.
 *
 * Two behaviours are load-bearing and must not be "simplified" away:
 *
 * - A read never rejects and never reports "no snapshot". Each format is read
 *   independently and its failures are swallowed, mirroring the old
 *   `try { clipboard.readText() } catch {}` chain, so a clipboard that cannot
 *   be read still lets the caller proceed with an empty snapshot.
 * - Writes are serialized through one FIFO queue. Synchronous clipboard writes
 *   got strict ordering from the event loop for free; making them
 *   asynchronous removes it, so the order the app issues writes in is the
 *   order they reach the system clipboard.
 */
import { clipboard, ClipboardItem } from 'electron'

import { Logger } from '../logger.js'

const TEXT_PLAIN = 'text/plain'
const TEXT_HTML = 'text/html'
const IMAGE_PREFIX = 'image/'

export interface ClipboardSnapshotData {
  text?: string
  html?: string
  image?: { mimeType: string; bytes: Buffer }
}

/**
 * The slice of `Electron.ClipboardItem` this module uses. Only plain Blob
 * flavours are ever requested, so the `electron application/bookmark` overload
 * of `getType` does not apply and every resolved value is a `Blob`.
 */
interface ClipboardItemLike {
  types: readonly string[]
  getType: (type: string) => Promise<Blob>
}

let writeQueue: Promise<unknown> = Promise.resolve()

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task)
  writeQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

/** Best-effort plain text for an HTML fragment, for the `text/plain` flavour. */
function stripHtmlToText(html: string): string {
  return (
    html
      // Block boundaries become newlines *before* the tags go, otherwise the tag
      // strip welds adjacent blocks together (`<p>a</p><p>b</p>` pastes as `ab`).
      .replaceAll(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
      .replaceAll(/<[^>]*>/g, '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      // `&amp;` last, so `&amp;lt;` decodes to `&lt;` instead of double-decoding.
      .replaceAll('&amp;', '&')
      // Only the newlines the block boundaries above introduced; whatever the
      // source text had at its edges is kept.
      .replaceAll(/^\n+|\n+$/g, '')
  )
}

function toImageBlob(image: { mimeType: string; bytes: Buffer }): Blob {
  // `Blob` requires a non-shared buffer; copying through `Uint8Array` narrows
  // `Buffer`'s `ArrayBufferLike` backing to a plain `ArrayBuffer`.
  return new Blob([new Uint8Array(image.bytes)], { type: image.mimeType })
}

/** Reads a text flavour; an empty value counts as absent, as before. */
async function readTextFlavour(item: ClipboardItemLike, type: string): Promise<string | undefined> {
  try {
    const value = await (await item.getType(type)).text()
    return value || undefined
  } catch {
    return undefined
  }
}

/** Reads an image flavour; zero-length bytes count as absent, as before. */
async function readImageFlavour(
  item: ClipboardItemLike,
  type: string
): Promise<{ mimeType: string; bytes: Buffer } | undefined> {
  try {
    const bytes = Buffer.from(await (await item.getType(type)).arrayBuffer())
    if (bytes.length === 0) return undefined
    return { mimeType: type, bytes }
  } catch {
    return undefined
  }
}

/**
 * Reads the clipboard as plain text, HTML and one image.
 *
 * The platform may spread the formats over several items, so every item is
 * scanned and the first flavour found for each format wins. Each flavour is
 * read in its own `try`/`catch` so one unreadable format cannot abort the
 * others; a total failure of `clipboard.read()` yields an empty snapshot.
 */
export async function readClipboardSnapshot(): Promise<ClipboardSnapshotData> {
  try {
    const items = (await clipboard.read()) as ClipboardItemLike[]
    let text: string | undefined
    let html: string | undefined
    let image: { mimeType: string; bytes: Buffer } | undefined

    for (const item of items) {
      if (text === undefined && item.types.includes(TEXT_PLAIN)) {
        text = await readTextFlavour(item, TEXT_PLAIN)
      }
      if (html === undefined && item.types.includes(TEXT_HTML)) {
        html = await readTextFlavour(item, TEXT_HTML)
      }
      const imageType = item.types.find((type) => type.startsWith(IMAGE_PREFIX))
      if (image === undefined && imageType !== undefined) {
        image = await readImageFlavour(item, imageType)
      }
    }

    return { text, html, image }
  } catch {
    return {}
  }
}

/** Writes plain text. Rejects if the write fails. */
export async function writeClipboardText(text: string): Promise<void> {
  await enqueueWrite(() => clipboard.write([new ClipboardItem({ [TEXT_PLAIN]: text })]))
}

/** Writes an image. Rejects if the write fails. */
export async function writeClipboardImage(image: {
  mimeType: string
  bytes: Buffer
}): Promise<void> {
  await enqueueWrite(() =>
    clipboard.write([new ClipboardItem({ [image.mimeType]: toImageBlob(image) })])
  )
}

/**
 * Restores a snapshot, preferring image over HTML over plain text — an
 * existing contract with the copy-and-send flow, not a preference.
 *
 * Resolves `false` when the write fails, so a caller can tell "restored" from
 * "clipboard refused it" without a thrown error. The refusal itself is logged
 * here: the caller only receives `false` across the IPC bridge, so this is the
 * one place that still knows whether the clipboard was locked by another app.
 */
export async function writeClipboardSnapshot(data: ClipboardSnapshotData): Promise<boolean> {
  return enqueueWrite(async () => {
    try {
      if (data.image) {
        await clipboard.write([
          new ClipboardItem({ [data.image.mimeType]: toImageBlob(data.image) })
        ])
      } else if (data.html) {
        await clipboard.write([
          new ClipboardItem({
            [TEXT_HTML]: data.html,
            [TEXT_PLAIN]: data.text ?? stripHtmlToText(data.html)
          })
        ])
      } else if (data.text !== undefined) {
        await clipboard.write([new ClipboardItem({ [TEXT_PLAIN]: data.text })])
      } else {
        clipboard.clear()
      }
      return true
    } catch (error) {
      Logger.error('[Clipboard] Failed to restore clipboard:', error)
      return false
    }
  })
}
