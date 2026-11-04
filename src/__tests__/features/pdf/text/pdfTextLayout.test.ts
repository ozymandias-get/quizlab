/**
 * Layout pipeline — reading order, paragraph reconstruction, lists and tables.
 *
 * The fixtures use the same inputs the extractors produce: one run per PDF.js
 * text item, with a measured box and (when available) PDF.js's `--font-height`.
 * There is no jsdom layout involved: every box is explicit, so the tests describe
 * geometry rather than relying on a browser to invent it.
 */
import { extractStructuredPdfText } from '@features/pdf/text/pdfTextPipeline'
import type { PdfTextItem } from '@features/pdf/text/types'

import { describe, expect, it } from 'vitest'

function run(
  text: string,
  left: number,
  top: number,
  width: number,
  fontSize = 12,
  height = fontSize
): PdfTextItem {
  return { text, left, top, width, height, fontSize }
}

function page(items: PdfTextItem[]): string {
  return extractStructuredPdfText(items, { mode: 'page' })
}

function selection(items: PdfTextItem[]): string {
  return extractStructuredPdfText(items, { mode: 'selection' })
}

describe('layout — paragraph reconstruction', () => {
  it('joins the visual lines of one paragraph', () => {
    const text = page([
      run('Kronik böbrek hastalığı böbrek', 50, 100, 300),
      run('fonksiyonlarının ilerleyici ve', 50, 114, 300),
      run('kalıcı kaybıyla karakterizedir.', 50, 128, 250)
    ])

    expect(text).toBe(
      'Kronik böbrek hastalığı böbrek fonksiyonlarının ilerleyici ve kalıcı kaybıyla karakterizedir.'
    )
  })

  it('keeps paragraphs separated by a larger vertical gap', () => {
    const text = page([
      run('Birinci paragrafın ilk satırı', 50, 100, 300),
      run('birinci paragrafın devamı', 50, 114, 300),
      run('İkinci paragrafın ilk satırı', 50, 150, 300),
      run('ikinci paragrafın devamı', 50, 164, 300)
    ])

    expect(text).toBe(
      'Birinci paragrafın ilk satırı birinci paragrafın devamı\n\n' +
        'İkinci paragrafın ilk satırı ikinci paragrafın devamı'
    )
  })

  it('keeps a short final line as a paragraph and does not merge the next block into it', () => {
    const text = page([
      run('Kısa bir paragraf.', 50, 100, 120),
      run('Sonraki paragraf ayrı bir bloktur.', 50, 140, 300)
    ])

    expect(text).toBe('Kısa bir paragraf.\n\nSonraki paragraf ayrı bir bloktur.')
  })

  it('removes a line-break hyphen but keeps the word intact', () => {
    const text = page([
      run('Kronik böbrek hasta-', 50, 100, 300),
      run('lığı tedavi edilir.', 50, 114, 250)
    ])

    expect(text).toBe('Kronik böbrek hastalığı tedavi edilir.')
  })

  it('keeps a real compound hyphen when the compound wraps', () => {
    const text = page([
      run('Bu well-', 50, 100, 300),
      run('known bir tedavi yöntemidir.', 50, 114, 250)
    ])

    expect(text).toBe('Bu well-known bir tedavi yöntemidir.')
  })

  it('keeps a Turkish compound hyphen when the compound wraps', () => {
    const text = page([
      run('Hastalık sosyo-', 50, 100, 300),
      run('ekonomik bir sorundur.', 50, 114, 250)
    ])

    expect(text).toBe('Hastalık sosyo-ekonomik bir sorundur.')
  })
})

describe('layout — columns and reading order', () => {
  it('reads a two-column page left column first', () => {
    const text = page([
      run('Sol sütun birinci satır', 50, 100, 180),
      run('Sağ sütun birinci satır', 320, 100, 180),
      run('sol sütun devamı', 50, 114, 180),
      run('sağ sütun devamı', 320, 114, 180)
    ])

    expect(text).toBe(
      'Sol sütun birinci satır sol sütun devamı\n\nSağ sütun birinci satır sağ sütun devamı'
    )
  })

  it('does not let a full-width heading collapse two columns into one', () => {
    const text = page([
      run('Tedavi Yaklaşımı', 50, 90, 450, 24, 24),
      run('Sol sütun birinci satır', 50, 130, 180),
      run('Sağ sütun birinci satır', 320, 130, 180),
      run('sol sütun devamı', 50, 144, 180),
      run('sağ sütun devamı', 320, 144, 180)
    ])

    expect(text).toBe(
      '## Tedavi Yaklaşımı\n\n' +
        'Sol sütun birinci satır sol sütun devamı\n\n' +
        'Sağ sütun birinci satır sağ sütun devamı'
    )
  })

  it('keeps a single-column page single-column even when lines are ragged', () => {
    const text = page([
      run('Uzun bir gövde satırı burada devam ediyor', 50, 100, 300),
      run('Kısa satır', 50, 114, 80),
      run('Yeni bir gövde satırı', 50, 150, 300)
    ])

    expect(text).toBe(
      'Uzun bir gövde satırı burada devam ediyor Kısa satır\n\nYeni bir gövde satırı'
    )
  })
})

describe('layout — lists', () => {
  it('preserves the original bullet markers and nested indentation', () => {
    const text = page([
      run('• Ana madde', 50, 100, 120),
      run('• Alt madde', 68, 114, 120),
      run('• İkinci ana madde', 50, 128, 140)
    ])

    expect(text).toBe('• Ana madde\n  • Alt madde\n• İkinci ana madde')
  })

  it('preserves numbered list numbers instead of renumbering', () => {
    const text = page([
      run('1. Birinci', 50, 100, 100),
      run('2. İkinci', 50, 114, 100),
      run('a) Alt madde', 68, 128, 100)
    ])

    expect(text).toBe('1. Birinci\n2. İkinci\n  a) Alt madde')
  })

  it('keeps a wrapped list item on one line', () => {
    const text = page([
      run('1. Uzun bir liste maddesi', 50, 100, 280),
      run('ikinci satırda devam ediyor', 68, 114, 240),
      run('2. Sonraki madde', 50, 128, 120)
    ])

    expect(text).toBe('1. Uzun bir liste maddesi ikinci satırda devam ediyor\n2. Sonraki madde')
  })

  it('does not merge the paragraph that follows a list into the last item', () => {
    const text = page([
      run('• Liste maddesi', 50, 100, 140),
      run('Listeden sonra gelen paragraf', 50, 114, 220)
    ])

    expect(text).toBe('• Liste maddesi\n\nListeden sonra gelen paragraf')
  })
})

describe('layout — tables', () => {
  it('serializes a reliable table as Markdown', () => {
    const text = page([
      run('Hastalık', 50, 100, 70),
      run('MCV', 200, 100, 40),
      run('Retikülosit', 300, 100, 80),
      run('Demir eksikliği', 50, 120, 100),
      run('Düşük', 200, 120, 40),
      run('Düşük', 300, 120, 40),
      run('Hemoliz', 50, 140, 60),
      run('Normal', 200, 140, 50),
      run('Yüksek', 300, 140, 50)
    ])

    expect(text).toBe(
      '| Hastalık | MCV | Retikülosit |\n' +
        '| --- | --- | --- |\n' +
        '| Demir eksikliği | Düşük | Düşük |\n' +
        '| Hemoliz | Normal | Yüksek |'
    )
  })

  it('serializes a small two-column table when the cells are genuinely short', () => {
    const text = page([
      run('Bulgu', 50, 100, 50),
      run('Sonuç', 200, 100, 50),
      run('Ateş', 50, 120, 40),
      run('38 °C', 200, 120, 40),
      run('Nabız', 50, 140, 46),
      run('92', 200, 140, 20)
    ])

    expect(text).toBe('| Bulgu | Sonuç |\n| --- | --- |\n| Ateş | 38 °C |\n| Nabız | 92 |')
  })

  it('falls back to row-preserving text when a cell is missing', () => {
    const text = page([
      run('Bulgu', 50, 100, 50),
      run('MCV', 200, 100, 40),
      run('Retikülosit', 300, 100, 80),
      run('Demir eksikliği', 50, 120, 100),
      run('Düşük', 200, 120, 40),
      run('Düşük', 300, 120, 40),
      run('Normal', 200, 140, 50),
      run('Yüksek', 300, 140, 50)
    ])

    expect(text).not.toContain('| --- |')
    expect(text).toContain('Bulgu | MCV | Retikülosit')
    expect(text).toContain('| Normal | Yüksek')
    expect(text).toContain('Demir eksikliği | Düşük | Düşük')
  })

  it('falls back to labelled text when a data cell is missing but the header is usable', () => {
    const text = page([
      run('Hastalık', 50, 100, 70),
      run('MCV', 200, 100, 40),
      run('Retikülosit', 300, 100, 80),
      run('Demir eksikliği', 50, 120, 100),
      run('Düşük', 200, 120, 40),
      run('Düşük', 300, 120, 40),
      run('Hemoliz', 50, 140, 60),
      run('Yüksek', 300, 140, 50)
    ])

    expect(text).not.toContain('| --- |')
    expect(text).toBe(
      'Demir eksikliği:\nMCV: Düşük\nRetikülosit: Düşük\n\n' + 'Hemoliz:\nRetikülosit: Yüksek'
    )
  })

  it('does not treat two side-by-side prose columns as a table', () => {
    const text = page([
      run('Sol sütunun ilk satırı', 50, 100, 170),
      run('Sağ sütunun ilk satırı', 320, 100, 170),
      run('Sol sütunun ikinci satırı', 50, 114, 170),
      run('Sağ sütunun ikinci satırı', 320, 114, 170)
    ])

    expect(text).not.toContain('| --- |')
    expect(text).toBe(
      'Sol sütunun ilk satırı Sol sütunun ikinci satırı\n\n' +
        'Sağ sütunun ilk satırı Sağ sütunun ikinci satırı'
    )
  })
})

describe('layout — characters and medical notation', () => {
  it('keeps superscripts, subscripts, Greek letters and comparison symbols', () => {
    const input = 'Na⁺ K⁺ Ca²⁺ HCO₃⁻ H₂O T₃ T₄ α β γ Δ ≥ ≤ ≠ ± → ↑ ↓'
    expect(page([run(input, 50, 100, 300)])).toBe(input)
  })

  it('keeps raised and lowered runs inside their word instead of making new lines', () => {
    const text = page([
      run('Na', 50, 100, 20, 12, 12),
      run('⁺', 72, 96, 6, 8, 8),
      run(' ve H', 78, 100, 30, 12, 12),
      run('₂', 108, 103, 6, 8, 8),
      run('O', 114, 100, 10, 12, 12)
    ])

    expect(text).toBe('Na⁺ ve H₂O')
  })

  it('does not split units or medical values with fabricated spaces', () => {
    const text = page([
      run('HbA1c %5–10; pH 7.4; 120/80 mmHg; mmol/L; mL/dk/1,73 m²', 50, 100, 380)
    ])

    expect(text).toBe('HbA1c %5–10; pH 7.4; 120/80 mmHg; mmol/L; mL/dk/1,73 m²')
    expect(text).not.toContain('mg / dL')
  })

  it('joins abutting runs without inserting a space inside a word', () => {
    const text = page([run('mg', 50, 100, 18), run('/dL', 68, 100, 20)])

    expect(text).toBe('mg/dL')
  })

  it('keeps a word gap that PDF.js encoded as trailing whitespace in a run', () => {
    const text = page([run('hello ', 50, 100, 36), run('world', 86, 100, 36)])

    expect(text).toBe('hello world')
  })

  it('keeps Turkish characters unchanged', () => {
    const input = 'İstanbul’da öğrenciler için ölçüm değerleri: ışık, çözüm, şube.'
    expect(page([run(input, 50, 100, 320)])).toBe(input)
  })

  it('expands typographic ligatures without touching other characters', () => {
    const text = page([run('efﬁcient ﬁzyoloji ﬂow', 50, 100, 200)])
    expect(text).toBe('efficient fizyoloji flow')
  })
})

describe('layout — edge cases', () => {
  it('returns a short single-line page unchanged', () => {
    expect(page([pageLine('Kısa not')])).toBe('Kısa not')
  })

  it('does not infer heading markers for a selection', () => {
    const text = selection([run('Tedavi Yaklaşımı', 50, 100, 300, 24, 24)])
    expect(text).toBe('Tedavi Yaklaşımı')
  })

  it('handles a long page without losing the last line', () => {
    const items = Array.from({ length: 400 }, (_, index) =>
      run(`satır ${index}`, 50, 100 + index * 14, 300)
    )
    const text = page(items)

    expect(text).toContain('satır 0')
    expect(text).toContain('satır 399')
    expect(text.length).toBeGreaterThan(1000)
  })

  it('returns an empty string when there is no measurable text', () => {
    expect(page([])).toBe('')
    expect(page([{ text: '', left: 0, top: 0, width: 0, height: 0 }])).toBe('')
  })
})

function pageLine(text: string): PdfTextItem {
  return run(text, 50, 100, Math.max(12, text.length * 6))
}
