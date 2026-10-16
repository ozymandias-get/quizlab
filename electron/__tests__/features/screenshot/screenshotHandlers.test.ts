import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

// Hoisted with the mock factory so `FakeClipboardItem` is initialized before
// the clipboard adapter's `electron` import is resolved.
const { FakeClipboardItem } = vi.hoisted(() => {
  class FakeClipboardItem {
    constructor(public readonly items: Record<string, Blob | string>) {}
  }

  return { FakeClipboardItem }
})

const ipcHandle = vi.fn()
const fromWebContents = vi.fn()
const read = vi.fn()
const write = vi.fn()
const clear = vi.fn()
const createFromDataURL = vi.fn()
const createFromBuffer = vi.fn()
const requireTrustedIpcSender = vi.fn()

vi.mock('electron', () => ({
  ipcMain: { handle: ipcHandle },
  BrowserWindow: { fromWebContents },
  clipboard: { read, write, clear },
  ClipboardItem: FakeClipboardItem,
  nativeImage: { createFromDataURL, createFromBuffer }
}))

vi.mock('../../../core/ipcSecurity', () => ({
  requireTrustedIpcSender
}))

interface ClipboardItemLike {
  types: string[]
  getType: (type: string) => Promise<Blob>
}

type FakeClipboardItemLike = InstanceType<typeof FakeClipboardItem>

/** A clipboard item exposing the flavours a read resolves with. */
function fakeItem(types: string[], values: Record<string, string>): ClipboardItemLike {
  return {
    types,
    getType: (type: string) => Promise.resolve(new Blob([values[type]], { type }))
  }
}

/** A non-empty NativeImage stand-in; `toPNG` supplies the bytes that get written. */
function fakeImage(bytes = 'image-bytes') {
  return { isEmpty: () => false, toPNG: () => Buffer.from(bytes) }
}

/** The `items` records the Nth clipboard.write() call carried. */
function writtenPayloads(callIndex = 0): Record<string, Blob | string>[] {
  const items = (write.mock.calls[callIndex]?.[0] ?? []) as FakeClipboardItemLike[]
  return items.map((item) => item.items)
}

/** Mime types carried by the Nth clipboard.write() call. */
function writtenTypes(callIndex = 0): string[] {
  return writtenPayloads(callIndex).flatMap((payload) => Object.keys(payload))
}

/** Text value the Nth clipboard.write() call carried for `type`. */
async function writtenText(type: string, callIndex = 0): Promise<string | undefined> {
  const payload = writtenPayloads(callIndex)[0]?.[type]
  if (payload === undefined) return undefined
  return typeof payload === 'string' ? payload : payload.text()
}

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('screenshotHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    fromWebContents.mockReset()
    read.mockReset().mockResolvedValue([])
    write.mockReset().mockResolvedValue(undefined)
    clear.mockReset()
    createFromDataURL.mockReset()
    createFromBuffer.mockReset().mockReturnValue({ isEmpty: () => true })
    requireTrustedIpcSender.mockReset()
  })

  it('returns null/false for untrusted senders', async () => {
    requireTrustedIpcSender.mockReturnValue(false)
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)

    expect(await captureHandler?.({ sender: {} })).toEqual({
      ok: false,
      error: { code: 'unauthorized', message: 'Not authorized' }
    })
    await expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')).resolves.toEqual({
      ok: true,
      data: false
    })
  })

  it('copies image when data URL is valid and image is non-empty', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue(fakeImage())
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const result = await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')

    expect(result).toEqual({ ok: true, data: true })
    expect(write).toHaveBeenCalledTimes(1)
    expect(writtenTypes(0)).toEqual(['image/png'])
  })

  it('rejects copy with non-image data URL prefix', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    await expect(copyHandler?.({ sender: {} }, 'data:text/html;base64,abc')).resolves.toEqual({
      ok: true,
      data: false
    })
    await expect(copyHandler?.({ sender: {} }, 'data:audio/mp3;base64,abc')).resolves.toEqual({
      ok: true,
      data: false
    })
    await expect(copyHandler?.({ sender: {} }, 'javascript:alert(1)')).resolves.toEqual({
      ok: true,
      data: false
    })
    expect(createFromDataURL).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('rejects copy when image parses to an empty native image', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue({ isEmpty: () => true })
    createFromBuffer.mockReturnValue({ isEmpty: () => true })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    await expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')).resolves.toEqual({
      ok: true,
      data: false
    })
    expect(write).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
  })

  it('falls back to createFromBuffer when createFromDataURL produces an empty image', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue({ isEmpty: () => true })
    createFromBuffer.mockReturnValue(fakeImage('buffer-bytes'))
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const result = await copyHandler?.({ sender: {} }, 'data:image/png;base64,YWJj')

    expect(result).toEqual({ ok: true, data: true })
    expect(createFromBuffer).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledTimes(1)
    expect(writtenTypes(0)).toEqual(['image/png'])
  })

  it('retries writeImage on transient clipboard failure', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue(fakeImage())
    write.mockRejectedValueOnce(new Error('Clipboard locked'))

    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const result = await copyHandler?.({ sender: {} }, 'data:image/png;base64,YWJj')

    expect(result).toEqual({ ok: true, data: true })
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('rejects copy when data URL exceeds the size limit', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const oversized = 'data:image/png;base64,' + 'A'.repeat(50 * 1024 * 1024)
    await expect(copyHandler?.({ sender: {} }, oversized)).resolves.toEqual({
      ok: true,
      data: false
    })
    expect(createFromDataURL).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('restores the previous clipboard text after an image copy', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    read.mockResolvedValue([fakeItem(['text/plain'], { 'text/plain': 'previous user text' })])
    createFromDataURL.mockReturnValue(fakeImage())
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

    // Before any copy, restoring is a no-op.
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: false })

    await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')
    expect(write).toHaveBeenCalledTimes(1)

    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: true })
    expect(await writtenText('text/plain', 1)).toBe('previous user text')

    // Snapshot is consumed: a second restore is a no-op.
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: false })
  })

  it('restores a previous image instead of text when the clipboard held an image', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    read.mockResolvedValue([
      fakeItem(['image/png', 'text/plain'], {
        'image/png': 'previous image',
        'text/plain': 'previous user text'
      })
    ])
    createFromDataURL.mockReturnValue(fakeImage())
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

    await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: true })
    expect(writtenTypes(1)).toEqual(['image/png'])
  })

  it('restores HTML when the clipboard held rich text', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    read.mockResolvedValue([
      fakeItem(['text/plain', 'text/html'], {
        'text/plain': 'rich text',
        'text/html': '<b>rich text</b>'
      })
    ])
    createFromDataURL.mockReturnValue(fakeImage())
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

    await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: true })
    expect(writtenTypes(1)).toEqual(['text/html', 'text/plain'])
    expect(await writtenText('text/html', 1)).toBe('<b>rich text</b>')
  })

  it('does not leak a snapshot when the clipboard write fails', async () => {
    // A snapshot that is pushed for a write that never lands used to stay on
    // the stack forever. That pinned a NativeImage of the user's real clipboard
    // and, once the stack filled, left later sends overwriting the clipboard
    // with no way to restore it.
    requireTrustedIpcSender.mockReturnValue(true)
    read.mockResolvedValue([fakeItem(['text/plain'], { 'text/plain': 'previous user text' })])
    createFromDataURL.mockReturnValue(fakeImage())
    write.mockRejectedValue(new Error('clipboard locked'))

    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

    // Three retries are attempted and all fail.
    for (let i = 0; i < 3; i++) {
      await expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')).resolves.toEqual({
        ok: true,
        data: false
      })
    }
    // Each of the three calls exhausts its three write attempts.
    expect(write).toHaveBeenCalledTimes(9)

    // The failed writes never replaced the clipboard, so there is nothing to
    // restore and no orphaned snapshot left behind.
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: false })
    expect(clear).not.toHaveBeenCalled()

    // A later successful copy must still capture and restore the user's text.
    write.mockResolvedValue(undefined)
    write.mockClear()
    await expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')).resolves.toEqual({
      ok: true,
      data: true
    })
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: true })
    expect(await writtenText('text/plain', 1)).toBe('previous user text')
  })

  /**
   * Pano snapshot sahipliği (kapsamlı akış).
   *
   * Çoklu görsel gönderimi N kopya yapar; her kopya için ayrı snapshot almak
   * yığını doldurup kullanıcının panosunu kalıcı olarak bozuyordu. Yeni
   * sözleşme: gönderim başına TEK snapshot, sahiplik anahtarıyla (scope)
   * eşleşen TEK restore, ve eşzamanlı gönderimler birbirinin snapshot'ına
   * dokunmaz.
   */
  describe('scoped clipboard ownership', () => {
    const SCOPE_A = 'send-aaa-1'
    const SCOPE_B = 'send-bbb-2'
    const IMAGE = 'data:image/png;base64,abc'

    it('takes a single snapshot for a multi-image send and restores it once', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      read.mockResolvedValue([fakeItem(['text/plain'], { 'text/plain': 'orijinal metin' })])
      createFromDataURL.mockReturnValue(fakeImage())
      const { registerScreenshotHandlers } =
        await import('../../../features/screenshot/screenshotHandlers.js')
      registerScreenshotHandlers()

      const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
      const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

      for (let i = 0; i < 5; i++) {
        await expect(copyHandler?.({ sender: {} }, IMAGE + i, SCOPE_A)).resolves.toEqual({
          ok: true,
          data: true
        })
      }
      expect(write).toHaveBeenCalledTimes(5)
      // Beş kopya tek snapshot okur: sahiplik kapsam başına bir kez kurulur.
      expect(read).toHaveBeenCalledTimes(1)

      expect(await restoreHandler?.({ sender: {} }, SCOPE_A)).toEqual({ ok: true, data: true })
      expect(write).toHaveBeenCalledTimes(6)
      expect(writtenTypes(5)).toEqual(['text/plain'])
      expect(await writtenText('text/plain', 5)).toBe('orijinal metin')

      // Sahiplik tükendi: aynı kapsam için ikinci restore no-op.
      expect(await restoreHandler?.({ sender: {} }, SCOPE_A)).toEqual({ ok: true, data: false })
    })

    it('defers the write until the last scope unwinds (concurrent sends keep their clipboard image)', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      read.mockResolvedValue([fakeItem(['text/plain'], { 'text/plain': 'orijinal metin' })])
      createFromDataURL.mockReturnValue(fakeImage())
      const { registerScreenshotHandlers } =
        await import('../../../features/screenshot/screenshotHandlers.js')
      registerScreenshotHandlers()

      const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
      const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

      await copyHandler?.({ sender: {} }, IMAGE + 'a', SCOPE_A)
      await copyHandler?.({ sender: {} }, IMAGE + 'b', SCOPE_B)
      // İkinci kapsam pano okumaz: aktif pano geçici bir uygulama görselidir,
      // en eski girdi (kullanıcının gerçek içeriği) referans alınır.
      expect(read).toHaveBeenCalledTimes(1)

      // A çözülürken B hâlâ aktif: pano yazılmaz ki B'nin yapıştırması
      // kullanıcının içeriğini okumasın.
      expect(await restoreHandler?.({ sender: {} }, SCOPE_A)).toEqual({ ok: true, data: true })
      expect(write).toHaveBeenCalledTimes(2)
      expect(writtenTypes(1)).toEqual(['image/png'])

      // B aktifken yapılan yeni kopya yine mevcut sahipliği paylaşır.
      await copyHandler?.({ sender: {} }, IMAGE + 'b2', SCOPE_B)
      expect(read).toHaveBeenCalledTimes(1)

      // Son unwind: kullanıcının içeriği BİR kez geri yazılır.
      expect(await restoreHandler?.({ sender: {} }, SCOPE_B)).toEqual({ ok: true, data: true })
      expect(write).toHaveBeenCalledTimes(4)
      expect(writtenTypes(3)).toEqual(['text/plain'])
      expect(await writtenText('text/plain', 3)).toBe('orijinal metin')
    })

    it('does not consume the send snapshot when a later copy fails', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      read.mockResolvedValue([fakeItem(['text/plain'], { 'text/plain': 'orijinal metin' })])
      createFromDataURL.mockReturnValue(fakeImage())
      const { registerScreenshotHandlers } =
        await import('../../../features/screenshot/screenshotHandlers.js')
      registerScreenshotHandlers()

      const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
      const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

      await expect(copyHandler?.({ sender: {} }, IMAGE + '1', SCOPE_A)).resolves.toEqual({
        ok: true,
        data: true
      })

      // İkinci görselin yazımı tüm denemelerde başarısız olur.
      write.mockRejectedValue(new Error('clipboard locked'))
      await expect(copyHandler?.({ sender: {} }, IMAGE + '2', SCOPE_A)).resolves.toEqual({
        ok: true,
        data: false
      })

      // Başarısız kopya ne kendi sahipliğini ne de panoyu bozar: gönderim
      // iptal edilse bile restore kullanıcının içeriğini geri yazar.
      write.mockResolvedValue(undefined)
      write.mockClear()
      expect(await restoreHandler?.({ sender: {} }, SCOPE_A)).toEqual({ ok: true, data: true })
      expect(write).toHaveBeenCalledTimes(1)
      expect(await writtenText('text/plain')).toBe('orijinal metin')
    })

    it('rejects unknown or malformed scopes without touching the clipboard', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      createFromDataURL.mockReturnValue(fakeImage())
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { registerScreenshotHandlers } =
        await import('../../../features/screenshot/screenshotHandlers.js')
      registerScreenshotHandlers()

      const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
      const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

      // Geçersiz kapsam: pano ezilmez, görsel çözümlenmez.
      await expect(copyHandler?.({ sender: {} }, IMAGE, 'bad scope!!')).resolves.toEqual({
        ok: true,
        data: false
      })
      expect(createFromDataURL).not.toHaveBeenCalled()

      // Bilinmeyen kapsam: restore başarısız bildirir, panoya yazılmaz.
      await expect(restoreHandler?.({ sender: {} }, 'send-unknown-9')).resolves.toEqual({
        ok: true,
        data: false
      })
      await expect(restoreHandler?.({ sender: {} }, 'bad scope!!')).resolves.toEqual({
        ok: true,
        data: false
      })
      expect(write).not.toHaveBeenCalled()
      expect(clear).not.toHaveBeenCalled()
      consoleWarn.mockRestore()
    })

    it('returns the ledger to its baseline so later sends capture fresh state', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      read.mockResolvedValue([fakeItem(['text/plain'], { 'text/plain': 'orijinal metin' })])
      createFromDataURL.mockReturnValue(fakeImage())
      const { registerScreenshotHandlers } =
        await import('../../../features/screenshot/screenshotHandlers.js')
      registerScreenshotHandlers()

      const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
      const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

      // İlk kopya hiç yazılamaz: kapsamlı akışta sahiplik kapanmak zorunda.
      write.mockRejectedValue(new Error('clipboard locked'))
      await expect(copyHandler?.({ sender: {} }, IMAGE, 'send-fail-9')).resolves.toEqual({
        ok: true,
        data: false
      })
      write.mockResolvedValue(undefined)
      expect(await restoreHandler?.({ sender: {} }, 'send-fail-9')).toEqual({
        ok: true,
        data: true
      })

      // Yığın taban çizgisine döndü: sonraki kopya panoyu YENİDEN okur
      // (yığın dolu olsaydı eski girdiye referans verir, okuma yapmazdı).
      write.mockClear()
      read.mockClear()
      await expect(copyHandler?.({ sender: {} }, IMAGE + 'next', 'send-next-9')).resolves.toEqual({
        ok: true,
        data: true
      })
      expect(read).toHaveBeenCalledTimes(1)
      expect(await restoreHandler?.({ sender: {} }, 'send-next-9')).toEqual({
        ok: true,
        data: true
      })
      expect(write).toHaveBeenCalledTimes(2)
      expect(await writtenText('text/plain', 1)).toBe('orijinal metin')
    })
  })

  it('does not let a copy issued during an in-flight restore clobber the clipboard', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    read.mockResolvedValue([fakeItem(['text/plain'], { 'text/plain': 'previous user text' })])
    createFromDataURL.mockReturnValue(fakeImage())

    // The first copy's write lands; the restore's write is then held open until
    // the test releases it, so the copy below is issued mid-restore.
    let releaseRestore = (): void => {}
    write
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseRestore = resolve
          })
      )

    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

    await expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,first')).resolves.toEqual({
      ok: true,
      data: true
    })
    const restore = restoreHandler?.({ sender: {} })
    await Promise.resolve()

    // The copy overlaps the pending restore; its own write must stay queued.
    const copy = copyHandler?.({ sender: {} }, 'data:image/png;base64,during-restore')
    await Promise.resolve()
    expect(write).toHaveBeenCalledTimes(2)

    releaseRestore()
    await expect(copy).resolves.toEqual({ ok: true, data: true })
    await expect(restore).resolves.toEqual({ ok: true, data: true })

    // Restore first, then the copy's image: the FIFO queue preserved the order.
    expect(write).toHaveBeenCalledTimes(3)
    expect(writtenTypes(1)).toEqual(['text/plain'])
    expect(await writtenText('text/plain', 1)).toBe('previous user text')
    expect(writtenTypes(2)).toEqual(['image/png'])
  })

  it('captures the whole page when sender is trusted and window exists', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const capturePage = vi.fn().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,page' })
    fromWebContents.mockReturnValue({ isDestroyed: () => false, webContents: { capturePage } })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    const result = await captureHandler?.({ sender: {} })

    expect(result).toEqual({ ok: true, data: 'data:image/png;base64,page' })
    expect(capturePage).toHaveBeenCalledWith(undefined)
  })

  it('returns null when window is missing or destroyed', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    fromWebContents.mockReturnValue(null)
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    expect(await captureHandler?.({ sender: {} })).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Window not available' }
    })
  })

  it('returns null and rejects oversized rect dimensions', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const capturePage = vi.fn()
    fromWebContents.mockReturnValue({ isDestroyed: () => false, webContents: { capturePage } })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    expect(
      await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: 99999, height: 100 })
    ).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' }
    })
    expect(
      await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: 100, height: 99999 })
    ).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' }
    })
    expect(await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: 0, height: 100 })).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' }
    })
    expect(await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: 100, height: 0 })).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' }
    })
    expect(await captureHandler?.({ sender: {} }, { x: 0, y: 0, width: -1, height: 100 })).toEqual({
      ok: false,
      error: { code: 'internal_error', message: 'Invalid or out-of-bounds rect' }
    })
    expect(capturePage).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('captures a valid rect', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const capturePage = vi
      .fn()
      .mockResolvedValue({ toDataURL: () => 'data:image/png;base64,region' })
    fromWebContents.mockReturnValue({ isDestroyed: () => false, webContents: { capturePage } })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const captureHandler = getHandler(APP_CONFIG.IPC_CHANNELS.CAPTURE_SCREEN)
    const rect = { x: 0, y: 0, width: 800, height: 600 }
    const result = await captureHandler?.({ sender: {} }, rect)

    expect(result).toEqual({ ok: true, data: 'data:image/png;base64,region' })
    expect(capturePage).toHaveBeenCalledWith(rect)
  })
})
