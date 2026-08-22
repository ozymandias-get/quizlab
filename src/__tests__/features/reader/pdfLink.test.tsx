import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'

import { resetPdfTabStore, usePdfTabStore } from '@features/pdf/hooks/usePdfTabStore'
import { resetPdfLinkStore, usePdfLinkStore } from '@features/reader/store/pdfLinkStore'
import ReaderView from '@features/reader/ui/ReaderView'
import type { QuizLabDocument } from '@shared-core/types'

function makeDoc(): QuizLabDocument {
  return {
    id: 'doc-1',
    title: 'Test',
    source: { pdfPath: '/tmp/a.pdf', pdfName: 'a.pdf', fileSize: null, fileHash: null },
    pageCount: 2,
    pages: [
      { pageNumber: 1, width: 595, height: 842, dpi: null },
      { pageNumber: 2, width: 595, height: 842, dpi: null }
    ],
    blocks: [
      {
        id: 'b1',
        type: 'paragraph',
        text: 'Hello',
        pageNumber: 2,
        bbox: { l: 10, t: 10, r: 100, b: 20 },
        prov: [{ pageNumber: 2, bbox: { l: 10, t: 10, r: 100, b: 20 } }],
        readingOrder: 0,
        parentId: null,
        childrenIds: [],
        metadata: {}
      } as never
    ],
    metadata: {
      converter: { name: 'docling', version: '2.121.0' },
      createdAt: Date.now(),
      conversionTimeMs: 10,
      readingOrderSource: 'docling_body'
    }
  }
}

describe('Reader ↔ PDF link', () => {
  beforeEach(() => {
    resetPdfTabStore()
    resetPdfLinkStore()
  })

  it("PDF'de Göster switches viewMode and queues page jump", () => {
    const tab = usePdfTabStore.getState().openPdfInTab({
      name: 'a.pdf',
      path: '/tmp/a.pdf',
      streamUrl: 'local-pdf://test',
      size: 100
    })
    expect(tab.viewMode).toBeUndefined()
    // Simulate Reader block click
    const doc = makeDoc()
    render(<ReaderView document={doc} />)
    const btn = screen.getByLabelText("PDF'de göster, sayfa 2")
    fireEvent.click(btn)

    const updatedTab = usePdfTabStore.getState().pdfTabs.find((t) => t.id === tab.id)
    expect(updatedTab?.viewMode).toBe('pdf')
    expect(updatedTab?.pendingJumpPage).toBe(2)

    const req = usePdfLinkStore.getState().pendingRequest
    expect(req?.pageNumber).toBe(2)
    expect(req?.tabId).toBe(tab.id)
  })

  it('PdfViewer consumes pendingJumpPage and clears it', () => {
    const tab = usePdfTabStore.getState().openPdfInTab({
      name: 'a.pdf',
      path: '/tmp/a.pdf',
      streamUrl: 'local-pdf://test',
      size: 100
    })
    usePdfTabStore.getState().setPendingJumpPage(tab.id, 5)
    expect(usePdfTabStore.getState().pdfTabs.find((t) => t.id === tab.id)?.pendingJumpPage).toBe(5)
    // Simulate viewer consuming
    const consumed = usePdfTabStore.getState().pdfTabs.find((t) => t.id === tab.id)?.pendingJumpPage
    if (consumed) {
      usePdfTabStore.getState().setPendingJumpPage(tab.id, null)
    }
    expect(
      usePdfTabStore.getState().pdfTabs.find((t) => t.id === tab.id)?.pendingJumpPage
    ).toBeNull()
  })

  it('preserves PDF tab state when switching views', () => {
    const tab1 = usePdfTabStore.getState().openPdfInTab({
      name: 'a.pdf',
      path: '/tmp/a.pdf',
      streamUrl: 'local-pdf://a',
      size: 100
    })
    const tab2 = usePdfTabStore.getState().openPdfInTab({
      name: 'b.pdf',
      path: '/tmp/b.pdf',
      streamUrl: 'local-pdf://b',
      size: 200
    })
    usePdfTabStore.getState().setPdfViewMode(tab1.id, 'reader')
    // tab1 should be reader, tab2 should remain pdf (undefined defaults to pdf)
    expect(usePdfTabStore.getState().pdfTabs.find((t) => t.id === tab1.id)?.viewMode).toBe('reader')
    expect(
      usePdfTabStore.getState().pdfTabs.find((t) => t.id === tab2.id)?.viewMode
    ).toBeUndefined()
    // Switch back
    usePdfTabStore.getState().setPdfViewMode(tab1.id, 'pdf')
    expect(usePdfTabStore.getState().pdfTabs.find((t) => t.id === tab1.id)?.viewMode).toBe('pdf')
  })
})
