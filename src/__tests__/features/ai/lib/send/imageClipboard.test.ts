/**
 * Unit coverage for the two side-effect units the image send pipeline delegates
 * to: the clipboard round-trip and the paste-never-landed predicate.
 *
 * Both used to live inline in a 330-line orchestration function, where the
 * restore's "exactly once, even from a `finally`" contract and the retry count
 * could not be asserted without driving the whole pipeline.
 */
import {
  copyImageToClipboardWithRetry,
  createClipboardRestore,
  RESTORE_SETTLE_MS
} from '@features/ai/lib/send/imageClipboard'
import { isPasteIgnoredByPage } from '@features/ai/lib/send/imageSendSubmitDiagnosis'
import type { AiSendDiagnostics } from '@features/ai/model/types'

import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RESTORE_SETTLE_FLOOR_MS } from './sharedTestHelpers'

const restoreClipboard = vi.fn()

vi.mock('@shared/lib/electronApi', () => ({
  getElectronApi: vi.fn()
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  reportSuppressedError: vi.fn()
}))

function makeDiagnostics(): AiSendDiagnostics {
  return {
    pipeline: 'image',
    currentAI: 'chatgpt',
    autoSend: true,
    timings: { queueWaitMs: 0, configResolveMs: 0, totalMs: 0 }
  } as unknown as AiSendDiagnostics
}

describe('copyImageToClipboardWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stops at the first success', async () => {
    const copy = vi.fn().mockResolvedValue(true)

    await expect(
      copyImageToClipboardWithRetry({
        copyImageToClipboard: copy,
        imageDataUrl: 'data:image/png;base64,AA',
        diagnostics: makeDiagnostics()
      })
    ).resolves.toBe(true)

    expect(copy).toHaveBeenCalledTimes(1)
  })

  it('gives up after three refusals and still records the elapsed time', async () => {
    const copy = vi.fn().mockResolvedValue(false)
    const diagnostics = makeDiagnostics()

    await expect(
      copyImageToClipboardWithRetry({
        copyImageToClipboard: copy,
        imageDataUrl: 'data:image/png;base64,AA',
        diagnostics
      })
    ).resolves.toBe(false)

    expect(copy).toHaveBeenCalledTimes(3)
    expect(typeof diagnostics.timings.clipboardMs).toBe('number')
  })

  it('treats a thrown write as a refusal instead of aborting the send', async () => {
    const copy = vi
      .fn()
      .mockRejectedValueOnce(new Error('clipboard busy'))
      .mockResolvedValueOnce(true)

    await expect(
      copyImageToClipboardWithRetry({
        copyImageToClipboard: copy,
        imageDataUrl: 'data:image/png;base64,AA',
        diagnostics: makeDiagnostics()
      })
    ).resolves.toBe(true)

    expect(copy).toHaveBeenCalledTimes(2)
  })

  it('carries the send scope into every copy attempt', async () => {
    const copy = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    await expect(
      copyImageToClipboardWithRetry({
        copyImageToClipboard: copy,
        imageDataUrl: 'data:image/png;base64,AA',
        scope: 'send-scope-1',
        diagnostics: makeDiagnostics()
      })
    ).resolves.toBe(true)

    // Yeniden denemeler bile AYNI sahiplik anahtarını taşır: ana süreç bu
    // kapsam için tek snapshot açar.
    expect(copy).toHaveBeenNthCalledWith(1, 'data:image/png;base64,AA', 'send-scope-1')
    expect(copy).toHaveBeenNthCalledWith(2, 'data:image/png;base64,AA', 'send-scope-1')
  })

  it('accumulates clipboardMs across the copies of a multi-image send', async () => {
    const copy = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return true
    })
    const diagnostics = makeDiagnostics()

    await copyImageToClipboardWithRetry({
      copyImageToClipboard: copy,
      imageDataUrl: 'a',
      scope: 's',
      diagnostics
    })
    const afterFirst = diagnostics.timings.clipboardMs ?? 0

    await copyImageToClipboardWithRetry({
      copyImageToClipboard: copy,
      imageDataUrl: 'b',
      scope: 's',
      diagnostics
    })

    // İlk kopyanın süresi korunur; ikinci kopya ÜZERİNE eklenir (son kopyanın
    // süresini "toplam" gibi göstermek yanlış olurdu).
    expect(afterFirst).toBeGreaterThanOrEqual(9)
    expect(diagnostics.timings.clipboardMs ?? 0).toBeGreaterThanOrEqual(afterFirst + 9)
  })
})

describe('createClipboardRestore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getElectronApi).mockReturnValue({
      restoreClipboard
    } as unknown as ReturnType<typeof getElectronApi>)
  })

  it('restores once and stays a no-op afterwards', async () => {
    const clipboard = createClipboardRestore()

    expect(clipboard.pending).toBe(true)
    await clipboard.restore()
    await clipboard.restore()

    expect(restoreClipboard).toHaveBeenCalledTimes(1)
    expect(clipboard.pending).toBe(false)
  })

  it('memoises the restore promise so concurrent and later calls share one IPC', async () => {
    const clipboard = createClipboardRestore()

    const first = clipboard.restore()
    const second = clipboard.restore()

    // Aynı promise: `void restore()` ile arka planda başlatılıp `finally`'de
    // await edilse bile IPC ikinci kez çalışmaz.
    expect(second).toBe(first)
    await Promise.all([first, second])
    await clipboard.restore()

    expect(restoreClipboard).toHaveBeenCalledTimes(1)
  })

  it('records how long the restore took when diagnostics are provided', async () => {
    const diagnostics = makeDiagnostics()
    const clipboard = createClipboardRestore(diagnostics)
    clipboard.markPasteCompleted()

    await clipboard.restore()

    // Ölçüm settle beklemesini de kapsar (RESTORE_SETTLE_MS).
    // Eşik `RESTORE_SETTLE_MS` DEĞİL, tolerans düşülmüş tabandır: setTimeout
    // tabanlı bekleme `performance.now()` farkı olarak birebir kendi süresini
    // garanti etmez (bkz. TIMER_TOLERANCE_MS).
    expect(typeof diagnostics.timings.clipboardRestoreMs).toBe('number')
    expect(diagnostics.timings.clipboardRestoreMs).toBeGreaterThanOrEqual(RESTORE_SETTLE_FLOOR_MS)
  })

  it('waits the settle period only when the paste actually completed', async () => {
    const withoutPaste = createClipboardRestore()
    const startedAt = Date.now()
    await withoutPaste.restore()
    const withoutPasteMs = Date.now() - startedAt

    // Yapıştırma hiç olmadıysa beklenecek bir şey yok: restore hemen döner.
    expect(withoutPasteMs).toBeLessThan(RESTORE_SETTLE_MS)
    expect(restoreClipboard).toHaveBeenCalledTimes(1)
  })

  it('reports a swallowed restore failure without throwing', async () => {
    restoreClipboard.mockRejectedValueOnce(new Error('gone'))
    const clipboard = createClipboardRestore()

    await expect(clipboard.restore()).resolves.toBeUndefined()
    // The attempt still counts as done, so a later `finally` does not retry it.
    expect(clipboard.pending).toBe(false)
  })

  it('survives a missing bridge', async () => {
    vi.mocked(getElectronApi).mockReturnValue(null)
    const clipboard = createClipboardRestore()

    await expect(clipboard.restore()).resolves.toBeUndefined()
    expect(clipboard.pending).toBe(false)
  })

  it("tags the restore with this send's ownership scope", async () => {
    const first = createClipboardRestore()
    const second = createClipboardRestore()

    // Kapsamlar benzersiz: eşzamanlı gönderimler birbirinin snapshot'ını
    // tüketemez.
    expect(first.scopeId).not.toBe(second.scopeId)
    expect(first.scopeId).toMatch(/^[A-Za-z0-9_-]{1,64}$/)

    await first.restore()

    expect(restoreClipboard).toHaveBeenCalledWith(first.scopeId)
  })

  it('records a restore failure when the main process reports no snapshot', async () => {
    // `false`: bu kapsam için sahiplik bulunamadı — "geri yüklendi" sayılmaz.
    restoreClipboard.mockResolvedValueOnce(false)
    const diagnostics = makeDiagnostics()
    const clipboard = createClipboardRestore(diagnostics)

    await clipboard.restore()

    expect(diagnostics.clipboardRestoreFailed).toBe(true)
    expect(reportSuppressedError).toHaveBeenCalled()
  })

  it('does not mark a failure when the restore succeeds', async () => {
    restoreClipboard.mockResolvedValueOnce(true)
    const diagnostics = makeDiagnostics()
    const clipboard = createClipboardRestore(diagnostics)

    await clipboard.restore()

    expect(diagnostics.clipboardRestoreFailed).toBeFalsy()
    expect(reportSuppressedError).not.toHaveBeenCalled()
  })
})

describe('isPasteIgnoredByPage', () => {
  it('is true only when the target never became interactive and nothing mutated', () => {
    expect(isPasteIgnoredByPage({ everReady: false, mutationCount: 0 } as never)).toBe(true)
    expect(isPasteIgnoredByPage({ everReady: false, mutationCount: 3 } as never)).toBe(false)
    expect(isPasteIgnoredByPage({ everReady: true, mutationCount: 0 } as never)).toBe(false)
  })

  it('is false when the runtime reported nothing', () => {
    expect(isPasteIgnoredByPage(null)).toBe(false)
    expect(isPasteIgnoredByPage(undefined)).toBe(false)
    expect(isPasteIgnoredByPage({} as never)).toBe(false)
  })
})
