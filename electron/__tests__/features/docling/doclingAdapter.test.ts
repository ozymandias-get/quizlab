import { describe, expect, it } from 'vitest'

import { adaptDoclingToQuizLabDocument } from '../../../features/docling/doclingAdapter.js'

function doclingFixture(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Doc',
    texts: [],
    pictures: [],
    tables: [],
    pages: [{ page_no: 1, size: { width: 595, height: 842 } }],
    body: { children: [] as never[] },
    ...overrides
  }
}

describe('doclingAdapter', () => {
  it('maps heading with level and provenance', () => {
    const raw = doclingFixture({
      texts: [
        {
          text: 'Chapter One',
          label: 'section_header',
          prov: [{ page_no: 1, bbox: { l: 10, t: 20, r: 100, b: 30 } }],
          level: 2
        }
      ],
      body: { children: [{ $ref: '#/texts/0' }] }
    })

    const doc = adaptDoclingToQuizLabDocument(raw, { pdfPath: '/tmp/a.pdf', pdfName: 'a.pdf' })
    expect(doc.blocks).toHaveLength(1)
    const b = doc.blocks[0] as unknown as {
      type: string
      level: number
      text: string
      pageNumber: number
      bbox: { l: number }
    }
    expect(b.type).toBe('heading')
    expect(b.level).toBe(2)
    expect(b.text).toBe('Chapter One')
    expect(b.pageNumber).toBe(1)
    expect(b.bbox?.l).toBe(10)
    expect(b).toHaveProperty('prov')
  })

  it('maps paragraph in reading order', () => {
    const raw = doclingFixture({
      texts: [
        {
          text: 'First',
          label: 'text',
          prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 10, b: 10 } }]
        },
        {
          text: 'Second',
          label: 'text',
          prov: [{ page_no: 2, bbox: { l: 0, t: 0, r: 10, b: 10 } }]
        }
      ],
      body: { children: [{ $ref: '#/texts/1' }, { $ref: '#/texts/0' }] }
    })
    const doc = adaptDoclingToQuizLabDocument(raw, { pdfPath: '/tmp/a.pdf' })
    expect(doc.blocks[0].type).toBe('paragraph')
    expect((doc.blocks[0] as unknown as { text: string }).text).toBe('Second')
    expect(doc.blocks[0].readingOrder).toBe(0)
    expect(doc.blocks[1].readingOrder).toBe(1)
    expect(doc.blocks[1].pageNumber).toBe(1)
  })

  it('maps image with bbox and asset reference', () => {
    const raw = doclingFixture({
      pictures: [
        {
          text: '',
          label: 'picture',
          prov: [{ page_no: 3, bbox: { l: 1, t: 2, r: 3, b: 4 } }],
          image: { uri: 'data:image/png;base64,abc' }
        }
      ],
      body: { children: [{ $ref: '#/pictures/0' }] }
    })
    const doc = adaptDoclingToQuizLabDocument(raw, { pdfPath: '/tmp/a.pdf' })
    const img = doc.blocks[0] as unknown as {
      type: string
      assetUrl: string
      pageNumber: number
      bbox: { r: number }
    }
    expect(img.type).toBe('image')
    expect(img.assetUrl).toBe('data:image/png;base64,abc')
    expect(img.pageNumber).toBe(3)
    expect(img.bbox?.r).toBe(3)
  })

  it('maps table with rows and headers', () => {
    const raw = doclingFixture({
      tables: [
        {
          text: 'a | b\nc | d',
          label: 'table',
          prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 10, b: 10 } }],
          data: {
            table_cells: [
              { text: 'H1', column_header: true },
              { text: 'H2', column_header: true },
              { text: 'C1' },
              { text: 'C2' }
            ]
          }
        }
      ],
      body: { children: [{ $ref: '#/tables/0' }] }
    })
    const doc = adaptDoclingToQuizLabDocument(raw, { pdfPath: '/tmp/a.pdf' })
    const table = doc.blocks[0] as unknown as {
      type: string
      rows: { text: string; isHeader?: boolean }[][]
    }
    expect(table.type).toBe('table')
    expect(table.rows[0][0].isHeader).toBe(true)
    expect(table.rows[0][0].text).toBe('H1')
  })

  it('preserves bbox provenance', () => {
    const raw = doclingFixture({
      texts: [
        {
          text: 'Hello',
          label: 'text',
          prov: [{ page_no: 5, bbox: { l: 11, t: 22, r: 33, b: 44 } }]
        }
      ],
      body: { children: [{ $ref: '#/texts/0' }] }
    })
    const doc = adaptDoclingToQuizLabDocument(raw, { pdfPath: '/x.pdf' })
    const prov = doc.blocks[0].prov[0]
    expect(prov.pageNumber).toBe(5)
    expect(prov.bbox.l).toBe(11)
    expect(prov.bbox.t).toBe(22)
  })

  it('handles wrapped { document: {...} } envelope', () => {
    const inner = doclingFixture({
      texts: [
        { text: 'Hi', label: 'text', prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 1, b: 1 } }] }
      ],
      body: { children: [{ $ref: '#/texts/0' }] }
    })
    const doc = adaptDoclingToQuizLabDocument({ document: inner }, { pdfPath: '/x.pdf' })
    expect(doc.blocks).toHaveLength(1)
  })

  it('creates unknown block for footnote', () => {
    const raw = doclingFixture({
      texts: [
        {
          text: 'note',
          label: 'footnote',
          prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 1, b: 1 } }]
        }
      ],
      body: { children: [{ $ref: '#/texts/0' }] }
    })
    const doc = adaptDoclingToQuizLabDocument(raw, { pdfPath: '/x.pdf' })
    expect(doc.blocks[0].type).toBe('unknown')
  })

  it('synthesizes pages when missing', () => {
    const raw = {
      texts: [
        { text: 'Hello', label: 'text', prov: [{ page_no: 2, bbox: { l: 0, t: 0, r: 1, b: 1 } }] }
      ],
      body: { children: [{ $ref: '#/texts/0' }] }
    }
    const doc = adaptDoclingToQuizLabDocument(raw, { pdfPath: '/x.pdf' })
    expect(doc.pageCount).toBe(2)
    expect(doc.pages).toHaveLength(2)
  })
})
