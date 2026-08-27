import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@shared/lib/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))
vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({ showError: vi.fn(), showSuccess: vi.fn() })
}))

let processPageDelay = 50
let processPageShouldResolve = true
const mockProcessPage: ReturnType<typeof vi.fn> = vi.fn(async () => {
  await new Promise((r) => setTimeout(r, processPageDelay))
  if (!processPageShouldResolve) throw new Error('NO_NATIVE_TEXT')
  return {
    pageNumber: 1,
    documentId: 'doc1',
    markdown: 'hi',
    plainText: 'hi',
    language: 'auto' as const,
    blocks: [],
    tables: [],
    formulas: [],
    engine: 'tesseract',
    engineVersion: '1.0.0',
    createdAt: Date.now(),
    config: {
      language: 'auto',
      quality: 'balanced',
      sensitivity: 'medium',
      forceOcr: false
    } as unknown as import('@features/ocr/types').OcrConfig,
    isNativeText: false,
    readingOrder: 'unknown' as const
  } as unknown as import('@features/ocr/types').OcrPageResult
})

vi.mock('@features/ocr/providers/hybridProvider', async () => {
  const actual = await vi.importActual<typeof import('@features/ocr/providers/hybridProvider')>(
    '@features/ocr/providers/hybridProvider'
  )
  return {
    ...actual,
    HYBRID_ENGINE_NAME: 'hybrid',
    createHybridProvider: () => ({
      name: 'hybrid',
      version: '1.0.0',
      initialize: vi.fn().mockResolvedValue(undefined),
      processPage: mockProcessPage,
      dispose: vi.fn().mockResolvedValue(undefined),
      getCapabilities: () => ({
        supportsTables: false,
        supportsFormulas: false,
        supportsLatex: false,
        supportsLayout: true,
        supportedLanguages: ['auto', 'tr', 'en'] as const
      })
    })
  }
})

vi.mock('@features/ocr/lib/renderPageToImage', async () => {
  const actual = await vi.importActual<typeof import('@features/ocr/lib/renderPageToImage')>(
    '@features/ocr/lib/renderPageToImage'
  )
  return {
    ...actual,
    renderPageToImageFallback: vi.fn(async () => ({
      blob: new Blob(['img'], { type: 'image/png' }),
      blobUrl: 'blob:fake',
      width: 10,
      height: 10
    })),
    getActivePdfDocumentFingerprint: vi.fn(() => null),
    setActivePdfDocument: vi.fn(),
    clearActivePdfDocument: vi.fn()
  }
})

import { resetOcrStore, useOcrStore } from '@features/ocr/store/useOcrStore'
import { globalOcrQueue } from '@features/ocr/lib/ocrQueue'
import { useOcrActions } from '@features/ocr/hooks/useOcrActions'
import { ocrCache } from '@features/ocr/lib/ocrCache'
import type { OcrConfig } from '@features/ocr/types'

const file = { path: '/a.pdf', name: 'a.pdf', size: 100, streamUrl: 'local-pdf://a' }

describe('cancel / timeout / PDF change invariants', () => {
  beforeEach(async () => {
    resetOcrStore()
    ocrCache.clear()
    globalOcrQueue.clear()
    localStorage.clear()
    mockProcessPage.mockClear()
    processPageDelay = 50
    processPageShouldResolve = true
    await new Promise((r) => setTimeout(r, 10))
  })

  it('cancel while processing => runningCount 0 and status cancelled', async () => {
    const { result } = renderHook(() => useOcrActions())
    const { processPage, cancel } = result.current
    processPageDelay = 200
    const p = processPage({ pageNumber: 1, pdfFile: file, pdfUrl: 'local-pdf://a' })
    await new Promise((r) => setTimeout(r, 30))
    expect(globalOcrQueue.runningCount).toBe(1)
    cancel()
    await p
    await new Promise((r) => setTimeout(r, 30))
    expect(globalOcrQueue.runningCount).toBe(0)
    expect(globalOcrQueue.pendingCount).toBe(0)
    expect(useOcrStore.getState().status).toBe('cancelled')
    expect(useOcrStore.getState().result).toBeNull()
  })

  it('cancel + immediately start another OCR => second succeeds', async () => {
    const { result } = renderHook(() => useOcrActions())
    const { processPage, cancel } = result.current
    processPageDelay = 200
    const p1 = processPage({ pageNumber: 1, pdfFile: file, pdfUrl: 'local-pdf://a' })
    await new Promise((r) => setTimeout(r, 30))
    cancel()
    processPageDelay = 10
    // Need fresh hook instance to avoid stale closure over processPageDelay? Use same instance but delay variable is captured via closure at call time, so new value applies to next job's mock
    const { result: result2 } = renderHook(() => useOcrActions())
    const p2 = result2.current.processPage({
      pageNumber: 2,
      pdfFile: file,
      pdfUrl: 'local-pdf://a'
    })
    const r2 = await p2
    await p1
    expect(r2).not.toBeNull()
    expect(useOcrStore.getState().currentPage).toBe(2)
    expect(globalOcrQueue.runningCount).toBe(0)
  })

  it('PDF change (token bump) while OCR active => stale result not written', async () => {
    const { result } = renderHook(() => useOcrActions())
    const { processPage } = result.current
    mockProcessPage.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 80))
      return {
        pageNumber: 1,
        documentId: 'docA',
        markdown: 'stale',
        plainText: 'stale',
        language: 'auto' as const,
        blocks: [],
        tables: [],
        formulas: [],
        engine: 'tesseract',
        engineVersion: '1.0.0',
        createdAt: Date.now(),
        config: {
          language: 'auto',
          quality: 'balanced',
          sensitivity: 'medium',
          forceOcr: true
        } as OcrConfig,
        isNativeText: false,
        readingOrder: 'unknown' as const
      } as unknown as import('@features/ocr/types').OcrPageResult
    })
    const p = processPage({ pageNumber: 1, pdfFile: file, pdfUrl: 'local-pdf://a' })
    await new Promise((r) => setTimeout(r, 20))
    // simulate document change
    useOcrStore.getState().bumpToken()
    useOcrStore.getState().clearTransientResult()
    await p
    await new Promise((r) => setTimeout(r, 20))
    // result should remain null (stale discarded), not stale
    expect(useOcrStore.getState().result).toBeNull()
    expect(ocrCache.size()).toBe(0)
  })

  it('timeout-like stale via token bump does not leave queue running', async () => {
    const { result } = renderHook(() => useOcrActions())
    const { processPage } = result.current
    processPageDelay = 150
    const p = processPage({ pageNumber: 1, pdfFile: file, pdfUrl: 'local-pdf://a' })
    await new Promise((r) => setTimeout(r, 30))
    useOcrStore.getState().bumpToken()
    globalOcrQueue.abortAll()
    await p
    await new Promise((r) => setTimeout(r, 20))
    expect(globalOcrQueue.runningCount).toBe(0)
    expect(globalOcrQueue.pendingCount).toBe(0)
  })
})
