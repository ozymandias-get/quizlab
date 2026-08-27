import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/logger', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

const mockProcessPage = vi.fn()
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

vi.mock('@shared/stores/toastStore', () => ({
  useToastActions: () => ({ showError: vi.fn(), showSuccess: vi.fn() })
}))

import { resetOcrStore, useOcrStore } from '@features/ocr/store/useOcrStore'
import { ocrCache } from '@features/ocr/lib/ocrCache'
import { globalOcrQueue } from '@features/ocr/lib/ocrQueue'
import { useOcrActions } from '@features/ocr/hooks/useOcrActions'
import {
  setActiveViewerSnapshot,
  clearActiveViewerSnapshot
} from '@features/pdf/lib/activeViewerSnapshot'
import type { OcrPageResult } from '@features/ocr/types'
import { renderHook } from '@testing-library/react'

function fakeResult(over: Partial<OcrPageResult> = {}): OcrPageResult {
  return {
    pageNumber: 2,
    documentId: 'docA',
    markdown: '# hello',
    plainText: 'hello',
    language: 'auto',
    blocks: [{ text: 'hello', kind: 'paragraph' }],
    tables: [],
    formulas: [],
    engine: 'tesseract',
    engineVersion: '1.0.0',
    createdAt: Date.now(),
    config: { language: 'auto', quality: 'balanced', sensitivity: 'medium', forceOcr: true },
    isNativeText: false,
    readingOrder: 'unknown',
    outcome: 'success',
    ...over
  }
}

const fileA = { path: '/pdfs/a.pdf', name: 'a.pdf', size: 1000, streamUrl: 'local-pdf://a' }
const fileB = { path: '/pdfs/b.pdf', name: 'b.pdf', size: 2000, streamUrl: 'local-pdf://b' }

describe('area OCR staleness — selection snapshot vs current viewer', () => {
  beforeEach(async () => {
    resetOcrStore()
    ocrCache.clear()
    globalOcrQueue.clear()
    clearActiveViewerSnapshot()
    mockProcessPage.mockReset()
    mockProcessPage.mockResolvedValue(fakeResult({ pageNumber: 2, documentId: 'docA' }))
    localStorage.clear()
    vi.clearAllMocks()
    // Allow any deferred queue microtasks to flush
    await new Promise((r) => setTimeout(r, 10))
  })

  it('PDF A page 2 selection -> switch to PDF B before capture => OCR must not run', async () => {
    setActiveViewerSnapshot(fileA, 2)
    useOcrStore.getState().startAreaSelection(2, fileA, 'local-pdf://a')
    const snapshotFp = useOcrStore.getState().pendingFingerprint!
    expect(snapshotFp).toBeTruthy()
    expect(useOcrStore.getState().pendingPage).toBe(2)

    setActiveViewerSnapshot(fileB, 2)
    useOcrStore.getState().bumpToken()

    const { result } = renderHook(() => useOcrActions())
    const result2 = await result.current.processArea({
      dataUrl: 'data:image/png;base64,abc',
      pageNumber: 2,
      pdfFile: fileA
    })

    expect(result2).toBeNull()
    expect(mockProcessPage).not.toHaveBeenCalled()
    expect(useOcrStore.getState().result).toBeNull()
    expect(ocrCache.size()).toBe(0)
    expect(globalOcrQueue.runningCount).toBe(0)
    expect(globalOcrQueue.pendingCount).toBe(0)
  })

  it('PDF A page 2 selection -> navigate to page 3 before capture => discard', async () => {
    setActiveViewerSnapshot(fileA, 2)
    useOcrStore.getState().startAreaSelection(2, fileA, 'local-pdf://a')
    setActiveViewerSnapshot(fileA, 3)
    const { result } = renderHook(() => useOcrActions())
    const res = await result.current.processArea({
      dataUrl: 'data:image/png;base64,abc',
      pageNumber: 2,
      pdfFile: fileA
    })
    expect(res).toBeNull()
    expect(mockProcessPage).not.toHaveBeenCalled()
    expect(useOcrStore.getState().result).toBeNull()
  })

  it('same PDF same page same selection => OCR succeeds', async () => {
    setActiveViewerSnapshot(fileA, 2)
    useOcrStore.getState().startAreaSelection(2, fileA, 'local-pdf://a')
    const expectedFp = useOcrStore.getState().pendingFingerprint!
    mockProcessPage.mockResolvedValue(
      fakeResult({ pageNumber: 2, documentId: expectedFp, markdown: 'ok' })
    )
    const { result } = renderHook(() => useOcrActions())
    const res = await result.current.processArea({
      dataUrl: 'data:image/png;base64,abc',
      pageNumber: 2,
      pdfFile: fileA
    })
    expect(mockProcessPage).toHaveBeenCalledTimes(1)
    expect(res).not.toBeNull()
    expect(res?.markdown).toBe('ok')
    expect(useOcrStore.getState().status).toBe('success')
    expect(globalOcrQueue.runningCount).toBe(0)
  })

  it('token bump after selection start => stale discard even if doc/page same', async () => {
    setActiveViewerSnapshot(fileA, 2)
    useOcrStore.getState().startAreaSelection(2, fileA, 'local-pdf://a')
    useOcrStore.getState().bumpToken()
    const { result } = renderHook(() => useOcrActions())
    const res = await result.current.processArea({
      dataUrl: 'data:image/png;base64,abc',
      pageNumber: 2,
      pdfFile: fileA
    })
    expect(res).toBeNull()
    expect(mockProcessPage).not.toHaveBeenCalled()
  })

  it('area job queued -> documentId changes but token same => provider not called (P2)', async () => {
    setActiveViewerSnapshot(fileA, 2)
    useOcrStore.getState().startAreaSelection(2, fileA, 'local-pdf://a')
    mockProcessPage.mockResolvedValue(
      fakeResult({ pageNumber: 2, documentId: 'different', markdown: 'should not happen' })
    )
    const { result } = renderHook(() => useOcrActions())
    const p = result.current.processArea({
      dataUrl: 'data:image/png;base64,abc',
      pageNumber: 2,
      pdfFile: fileA
    })
    // Change documentId without bumping token while job is queued (queue is deferred via microtask)
    await Promise.resolve()
    useOcrStore.setState({ currentDocumentId: 'different-doc-id' })
    const res = await p
    expect(res).toBeNull()
    expect(mockProcessPage).not.toHaveBeenCalled()
    expect(useOcrStore.getState().result).toBeNull()
    expect(ocrCache.size()).toBe(0)
  })
})
