import type { QuizLabDocument } from '@shared-core/types'

import ReaderView from '@features/reader/ui/ReaderView'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function makeDoc(overrides: Partial<QuizLabDocument> = {}): QuizLabDocument {
  return {
    id: 'doc-1',
    title: 'Test Doc',
    source: { pdfPath: '/tmp/a.pdf', pdfName: 'a.pdf', fileSize: null, fileHash: null },
    pageCount: 1,
    pages: [{ pageNumber: 1, width: 595, height: 842, dpi: null }],
    blocks: [],
    metadata: {
      converter: { name: 'docling', version: '2.121.0' },
      createdAt: Date.now(),
      conversionTimeMs: 100,
      readingOrderSource: 'docling_body'
    },
    ...overrides
  }
}

describe('ReaderView', () => {
  it('renders heading, paragraph, list, image, table and caption', () => {
    const doc = makeDoc({
      blocks: [
        {
          id: 'h1',
          type: 'heading',
          level: 1,
          text: 'Title',
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 0,
          childrenIds: []
        },
        {
          id: 'p1',
          type: 'paragraph',
          text: 'Hello world',
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 1,
          childrenIds: []
        },
        {
          id: 'l1',
          type: 'list',
          ordered: false,
          items: ['list-a', 'list-b'],
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 2,
          childrenIds: []
        },
        {
          id: 'img1',
          type: 'image',
          caption: 'cap',
          alt: 'alt',
          assetId: 'img1',
          assetUrl: 'quizlab-asset://docling/t1/images/img1.png',
          width: null,
          height: null,
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 3,
          childrenIds: []
        },
        {
          id: 't1',
          type: 'table',
          caption: null,
          rows: [[{ text: 'cell-a' }, { text: 'cell-b' }]],
          html: null,
          assetId: null,
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 4,
          childrenIds: []
        },
        {
          id: 'c1',
          type: 'caption',
          text: 'Figure 1',
          forBlockId: null,
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 5,
          childrenIds: []
        }
      ] as never
    })

    render(<ReaderView document={doc} />)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('list-a')).toBeInTheDocument()
    expect(screen.getByAltText('alt')).toBeInTheDocument()
    expect(screen.getByText('Figure 1')).toBeInTheDocument()
    // table cell
    expect(screen.getByText('cell-b')).toBeInTheDocument()
    // page badge
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('renders fallback for unknown block', () => {
    const doc = makeDoc({
      blocks: [
        {
          id: 'u1',
          type: 'unknown',
          rawText: 'mystery',
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 0,
          childrenIds: []
        } as never
      ]
    })
    render(<ReaderView document={doc} />)
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })

  it('keeps aspect ratio and does not overflow images', () => {
    const doc = makeDoc({
      blocks: [
        {
          id: 'img2',
          type: 'image',
          caption: null,
          alt: 'big',
          assetId: 'img2',
          assetUrl: 'quizlab-asset://docling/t1/images/img2.png',
          width: null,
          height: null,
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 0,
          childrenIds: []
        } as never
      ]
    })
    const { container } = render(<ReaderView document={doc} />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.className).toContain('object-contain')
    expect(img.className).toContain('max-h-[70vh]')
  })

  it('handles large document without crashing (500 blocks)', () => {
    const blocks = Array.from({ length: 500 }, (_, i) => ({
      id: `p-${i}`,
      type: 'paragraph',
      text: `Paragraph ${i} with some text to render `.repeat(5),
      pageNumber: (i % 10) + 1,
      bbox: undefined,
      prov: [],
      readingOrder: i,
      childrenIds: []
    })) as never

    const doc = makeDoc({
      blocks,
      pageCount: 10,
      pages: Array.from({ length: 10 }, (_, i) => ({
        pageNumber: i + 1,
        width: 595,
        height: 842,
        dpi: null
      }))
    })
    const start = performance.now()
    render(<ReaderView document={doc} />)
    const elapsed = performance.now() - start
    // Should render under 1000ms even for 500 blocks (content-visibility helps)
    expect(elapsed).toBeLessThan(1000)
    expect(screen.getByText(/Paragraph 0/)).toBeInTheDocument()
    expect(screen.getByText(/Paragraph 499/)).toBeInTheDocument()
  })

  it('uses semantic headings for accessibility', () => {
    const doc = makeDoc({
      blocks: [
        {
          id: 'h2',
          type: 'heading',
          level: 2,
          text: 'Section',
          pageNumber: 1,
          bbox: undefined,
          prov: [],
          readingOrder: 0,
          childrenIds: []
        } as never
      ]
    })
    const { container } = render(<ReaderView document={doc} />)
    expect(container.querySelector('h2')).toBeInTheDocument()
  })
})
