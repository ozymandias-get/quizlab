/**
 * Paylaşılan PDF.js mock factory'leri.
 *
 * 14 native viewer testi aynı `vi.mock('pdfjs-dist')` + `vi.mock(pdfWorker)`
 * gövdesini satır satır tekrarlıyordu (getDocument + TextLayer + AnnotationLayer
 * + RenderingCancelledException, worker için initialize + URL + reset). Tek
 * kaynak burada; test dosyalarında yalnızca iki kısa `vi.mock` çağrısı kalır.
 *
 * `vi.mock` çağrılarının kendisi dosya başına kalmak zorundadır: factory
 * hoisting nedeniyle paylaşılan bir `vi.mock` bloğu import edilemez, ancak
 * factory *içinden* `await import()` ile bu modüle ulaşmak güvenlidir (bu
 * modül `pdfjs-dist` import etmez, dolayısıyla mock'lanan modüle geri girmez).
 * Test izolasyonu korunur: her test dosyası kendi modül kaydıyla kendi
 * double örneklerini alır; `FakeTextLayer` / `FakeAnnotationLayer` sınıfları
 * hâlâ `nativeTextLayerDouble` / `nativeAnnotationLayerDouble` modüllerinden
 * gelir.
 *
 * Kapsam dışı (bilinçli): `engine/captureDocument.test.ts` ve
 * `engine/documentManager.test.ts` minimal yüzeyle (`getDocument` ve kısmi
 * worker) çalışır; bunlar engine birim testidir, viewer çiftini kullanmaz.
 */
import { vi } from 'vitest'

export interface PdfJsDistMocks {
  getDocument: ReturnType<typeof vi.fn>
}

export interface PdfWorkerMocks {
  initializeNativePdfWorker: ReturnType<typeof vi.fn>
}

export class RenderingCancelledException extends Error {
  constructor(message = 'Rendering cancelled') {
    super(message)
    this.name = 'RenderingCancelledException'
  }
}

export async function createPdfJsDistMock(mocks: PdfJsDistMocks): Promise<{
  getDocument: PdfJsDistMocks['getDocument']
  TextLayer: unknown
  AnnotationLayer: unknown
  RenderingCancelledException: typeof RenderingCancelledException
}> {
  // Statik import yok: `vi.mock` factory'si dosyanın statik importlarının
  // üzerine hoisted edilir; double'lar bağımlılıksız kendi modüllerinde
  // yaşadığı için buradan beklemek mock'lanan modüle geri girmez.
  const { FakeAnnotationLayer } = await import('./nativeAnnotationLayerDouble')
  const { FakeTextLayer } = await import('./nativeTextLayerDouble')
  return {
    getDocument: mocks.getDocument,
    TextLayer: FakeTextLayer,
    AnnotationLayer: FakeAnnotationLayer,
    RenderingCancelledException
  }
}

export function createPdfWorkerMock(mocks: PdfWorkerMocks): {
  initializeNativePdfWorker: PdfWorkerMocks['initializeNativePdfWorker']
  nativeWorkerUrl: string
  resetNativePdfWorkerForTests: ReturnType<typeof vi.fn>
} {
  return {
    initializeNativePdfWorker: mocks.initializeNativePdfWorker,
    nativeWorkerUrl: 'pdf.worker.min.test.mjs',
    resetNativePdfWorkerForTests: vi.fn()
  }
}
