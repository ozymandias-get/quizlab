import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_CONFIG } from '../../../app/constants.js'

const ipcHandle = vi.fn()
const fromWebContents = vi.fn()
const writeImage = vi.fn()
const readImage = vi.fn()
const readText = vi.fn()
const readHTML = vi.fn()
const writeText = vi.fn()
const writeHTML = vi.fn()
const clear = vi.fn()
const createFromDataURL = vi.fn()
const createFromBuffer = vi.fn()
const requireTrustedIpcSender = vi.fn()

vi.mock('electron', () => ({
  ipcMain: { handle: ipcHandle },
  BrowserWindow: { fromWebContents },
  clipboard: { writeImage, readImage, readText, readHTML, writeText, writeHTML, clear },
  nativeImage: { createFromDataURL, createFromBuffer }
}))

vi.mock('../../../core/ipcSecurity', () => ({
  requireTrustedIpcSender
}))

function getHandler(channel: string) {
  return ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1]
}

describe('screenshotHandlers', () => {
  beforeEach(() => {
    vi.resetModules()
    ipcHandle.mockReset()
    fromWebContents.mockReset()
    writeImage.mockReset()
    readImage.mockReset()
    readText.mockReset()
    readHTML.mockReset()
    writeText.mockReset()
    writeHTML.mockReset()
    clear.mockReset()
    createFromDataURL.mockReset()
    createFromBuffer.mockReset().mockReturnValue({ isEmpty: () => true })
    requireTrustedIpcSender.mockReset()
    readText.mockReturnValue('')
    readHTML.mockReturnValue('')
    readImage.mockReturnValue({ isEmpty: () => true })
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
    createFromDataURL.mockReturnValue({ isEmpty: () => false })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const result = await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')

    expect(result).toEqual({ ok: true, data: true })
    expect(writeImage).toHaveBeenCalledTimes(1)
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
    expect(writeImage).not.toHaveBeenCalled()
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
    expect(writeImage).not.toHaveBeenCalled()
  })

  it('falls back to createFromBuffer when createFromDataURL produces an empty image', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue({ isEmpty: () => true })
    createFromBuffer.mockReturnValue({ isEmpty: () => false })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const result = await copyHandler?.({ sender: {} }, 'data:image/png;base64,YWJj')

    expect(result).toEqual({ ok: true, data: true })
    expect(createFromBuffer).toHaveBeenCalledTimes(1)
    expect(writeImage).toHaveBeenCalledTimes(1)
  })

  it('retries writeImage on transient clipboard failure', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    createFromDataURL.mockReturnValue({ isEmpty: () => false })
    writeImage
      .mockImplementationOnce(() => {
        throw new Error('Clipboard locked')
      })
      .mockImplementationOnce(() => undefined)

    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const result = await copyHandler?.({ sender: {} }, 'data:image/png;base64,YWJj')

    expect(result).toEqual({ ok: true, data: true })
    expect(writeImage).toHaveBeenCalledTimes(2)
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
    expect(writeImage).not.toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('restores the previous clipboard text after an image copy', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    readText.mockReturnValue('previous user text')
    readHTML.mockReturnValue('')
    readImage.mockReturnValue({ isEmpty: () => true })
    createFromDataURL.mockReturnValue({ isEmpty: () => false })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

    // Before any copy, restoring is a no-op.
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: false })

    await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')
    expect(writeImage).toHaveBeenCalledTimes(1)

    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: true })
    expect(writeText).toHaveBeenCalledWith('previous user text')

    // Snapshot is consumed: a second restore is a no-op.
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: false })
  })

  it('restores a previous image instead of text when the clipboard held an image', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    const prevImage = { isEmpty: () => false }
    readImage.mockReturnValue(prevImage)
    createFromDataURL.mockReturnValue({ isEmpty: () => false })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

    await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: true })
    expect(writeImage).toHaveBeenLastCalledWith(prevImage)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('restores HTML when the clipboard held rich text', async () => {
    requireTrustedIpcSender.mockReturnValue(true)
    readText.mockReturnValue('rich text')
    readHTML.mockReturnValue('<b>rich text</b>')
    readImage.mockReturnValue({ isEmpty: () => true })
    createFromDataURL.mockReturnValue({ isEmpty: () => false })
    const { registerScreenshotHandlers } =
      await import('../../../features/screenshot/screenshotHandlers.js')
    registerScreenshotHandlers()

    const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
    const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

    await copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: true })
    expect(writeHTML).toHaveBeenCalledWith('<b>rich text</b>')
  })

  it('does not leak a snapshot when the clipboard write fails', async () => {
    // A snapshot that is pushed for a write that never lands used to stay on
    // the stack forever. That pinned a NativeImage of the user's real clipboard
    // and, once the stack filled, left later sends overwriting the clipboard
    // with no way to restore it.
    requireTrustedIpcSender.mockReturnValue(true)
    readText.mockReturnValue('previous user text')
    createFromDataURL.mockReturnValue({ isEmpty: () => false })
    writeImage.mockImplementation(() => {
      throw new Error('clipboard locked')
    })

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
    expect(writeImage).toHaveBeenCalledTimes(9)

    // The failed writes never replaced the clipboard, so there is nothing to
    // restore and no orphaned snapshot left behind.
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: false })
    expect(writeText).not.toHaveBeenCalled()

    // A later successful copy must still capture and restore the user's text.
    writeImage.mockImplementation(() => undefined)
    readText.mockReturnValue('previous user text')
    await expect(copyHandler?.({ sender: {} }, 'data:image/png;base64,abc')).resolves.toEqual({
      ok: true,
      data: true
    })
    expect(await restoreHandler?.({ sender: {} })).toEqual({ ok: true, data: true })
    expect(writeText).toHaveBeenCalledWith('previous user text')
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
      readText.mockReturnValue('orijinal metin')
      createFromDataURL.mockReturnValue({ isEmpty: () => false })
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
      expect(writeImage).toHaveBeenCalledTimes(5)
      // Beş kopya tek snapshot okur: sahiplik kapsam başına bir kez kurulur.
      expect(readText).toHaveBeenCalledTimes(1)
      expect(readHTML).toHaveBeenCalledTimes(1)
      expect(readImage).toHaveBeenCalledTimes(1)

      expect(await restoreHandler?.({ sender: {} }, SCOPE_A)).toEqual({ ok: true, data: true })
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith('orijinal metin')

      // Sahiplik tükendi: aynı kapsam için ikinci restore no-op.
      expect(await restoreHandler?.({ sender: {} }, SCOPE_A)).toEqual({ ok: true, data: false })
    })

    it('defers the write until the last scope unwinds (concurrent sends keep their clipboard image)', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      readText.mockReturnValue('orijinal metin')
      createFromDataURL.mockReturnValue({ isEmpty: () => false })
      const { registerScreenshotHandlers } =
        await import('../../../features/screenshot/screenshotHandlers.js')
      registerScreenshotHandlers()

      const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
      const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

      await copyHandler?.({ sender: {} }, IMAGE + 'a', SCOPE_A)
      await copyHandler?.({ sender: {} }, IMAGE + 'b', SCOPE_B)
      // İkinci kapsam pano okumaz: aktif pano geçici bir uygulama görselidir,
      // en eski girdi (kullanıcının gerçek içeriği) referans alınır.
      expect(readText).toHaveBeenCalledTimes(1)

      // A çözülürken B hâlâ aktif: pano yazılmaz ki B'nin yapıştırması
      // kullanıcının içeriğini okumasın.
      expect(await restoreHandler?.({ sender: {} }, SCOPE_A)).toEqual({ ok: true, data: true })
      expect(writeText).not.toHaveBeenCalled()

      // B aktifken yapılan yeni kopya yine mevcut sahipliği paylaşır.
      await copyHandler?.({ sender: {} }, IMAGE + 'b2', SCOPE_B)
      expect(readText).toHaveBeenCalledTimes(1)

      // Son unwind: kullanıcının içeriği BİR kez geri yazılır.
      expect(await restoreHandler?.({ sender: {} }, SCOPE_B)).toEqual({ ok: true, data: true })
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith('orijinal metin')
      expect(writeImage).toHaveBeenCalledTimes(3)
    })

    it('does not consume the send snapshot when a later copy fails', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      readText.mockReturnValue('orijinal metin')
      createFromDataURL.mockReturnValue({ isEmpty: () => false })
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
      writeImage.mockImplementation(() => {
        throw new Error('clipboard locked')
      })
      await expect(copyHandler?.({ sender: {} }, IMAGE + '2', SCOPE_A)).resolves.toEqual({
        ok: true,
        data: false
      })

      // Başarısız kopya ne kendi sahipliğini ne de panoyu bozar: gönderim
      // iptal edilse bile restore kullanıcının içeriğini geri yazar.
      writeImage.mockImplementation(() => undefined)
      expect(await restoreHandler?.({ sender: {} }, SCOPE_A)).toEqual({ ok: true, data: true })
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith('orijinal metin')
    })

    it('rejects unknown or malformed scopes without touching the clipboard', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      createFromDataURL.mockReturnValue({ isEmpty: () => false })
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
      expect(writeText).not.toHaveBeenCalled()
      consoleWarn.mockRestore()
    })

    it('returns the ledger to its baseline so later sends capture fresh state', async () => {
      requireTrustedIpcSender.mockReturnValue(true)
      readText.mockReturnValue('orijinal metin')
      createFromDataURL.mockReturnValue({ isEmpty: () => false })
      const { registerScreenshotHandlers } =
        await import('../../../features/screenshot/screenshotHandlers.js')
      registerScreenshotHandlers()

      const copyHandler = getHandler(APP_CONFIG.IPC_CHANNELS.COPY_IMAGE)
      const restoreHandler = getHandler(APP_CONFIG.IPC_CHANNELS.RESTORE_CLIPBOARD)

      // İlk kopya hiç yazılamaz: kapsamlı akışta sahiplik kapanmak zorunda.
      writeImage.mockImplementation(() => {
        throw new Error('clipboard locked')
      })
      await expect(copyHandler?.({ sender: {} }, IMAGE, 'send-fail-9')).resolves.toEqual({
        ok: true,
        data: false
      })
      writeImage.mockImplementation(() => undefined)
      expect(await restoreHandler?.({ sender: {} }, 'send-fail-9')).toEqual({
        ok: true,
        data: true
      })

      // Yığın taban çizgisine döndü: sonraki kopya panoyu YENİDEN okur
      // (yığın dolu olsaydı eski girdiye referans verir, okuma yapmazdı).
      writeText.mockClear()
      readText.mockClear()
      await expect(copyHandler?.({ sender: {} }, IMAGE + 'next', 'send-next-9')).resolves.toEqual({
        ok: true,
        data: true
      })
      expect(readText).toHaveBeenCalledTimes(1)
      expect(await restoreHandler?.({ sender: {} }, 'send-next-9')).toEqual({
        ok: true,
        data: true
      })
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith('orijinal metin')
    })
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
