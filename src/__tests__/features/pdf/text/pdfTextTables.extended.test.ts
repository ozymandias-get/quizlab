/**
 * Table reconstruction — regression coverage for visually structured PDF tables.
 *
 * The fixtures use real `PdfTextItem` geometry: column starts, cell widths, font
 * heights and row coordinates. The Adjuvan Analjezikler fixture is measured from
 * the source PDF (page 31 of the lecture deck), including its tall rows and the
 * header row that is larger than the body cells.
 */
import {
  extractPageTextFromDom,
  invalidatePageCache
} from '@features/pdf/text/extractPageTextFromDom'
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

/** Page 31 of `5.Ağrı ve Ağrı Tedavisi.pdf`, measured with pdf.js at 960×540. */
const ADJUVAN_PAGE: PdfTextItem[] = [
  run('Adjuvan Analjezikler', 50.5, 74.2, 259.1, 27.1),
  run('Grup', 61.3, 147.1, 28.2, 13.5),
  run('Örnek', 227, 147.1, 34.2, 13.5),
  run('Kullanım Alanı / Dikkat', 428.7, 147.1, 129.1, 13.5),
  run('Gabapentinoidler', 61.3, 194.7, 83.4, 11.3),
  run('Gabapentin, pregabalin', 227, 194.7, 109.2, 11.3),
  run('Seçilmiş nöropatik ağrılar; sedasyon, baş dönmesi, ödem', 428.7, 194.7, 263.6, 11.3),
  run('SNRI', 61.3, 252.4, 22.5, 11.3),
  run('Duloksetin, venlafaksin', 227, 252.4, 107.8, 11.3),
  run(
    'Nöropatik ağrı, fibromiyalji vb.; bulantı, tansiyon/serotonerjik etkiler',
    428.7,
    252.4,
    319.3,
    11.3
  ),
  run('TCA', 61.3, 310, 18.8, 11.3),
  run('Amitriptilin', 227, 310, 52.4, 11.3),
  run('Nöropatik ağrı; antikolinerjik ve kardiyak etkiler', 428.7, 310, 221.9, 11.3),
  run('Lokal/topikal', 61.3, 367.7, 62.7, 11.3),
  run('Lidokain, kapsaisin', 227, 367.7, 86.8, 11.3),
  run('Lokalize nöropatik ağrıda seçilmiş kullanım', 428.7, 367.7, 198.5, 11.3),
  run('Kortikosteroid', 61.3, 425.4, 68.2, 11.3),
  run('Deksametazon vb.', 227, 425.4, 86, 11.3),
  run('Ödem/inflamasyonla ilişkili seçilmiş ağrı durumları', 428.7, 425.4, 233.3, 11.3),
  run('α2 agonist', 61.3, 483.1, 50.3, 11.3),
  run('Klonidin, deksmedetomidin', 227, 483.1, 127.9, 11.3),
  run('Seçilmiş perioperatif/adjuvan kullanım', 428.7, 483.1, 179, 11.3)
]

describe('pdf tables — Adjuvan Analjezikler (real geometry)', () => {
  it('reconstructs the three-column table as Markdown and keeps the page heading', () => {
    const text = page(ADJUVAN_PAGE)

    expect(text).toBe(
      '## Adjuvan Analjezikler\n\n' +
        '| Grup | Örnek | Kullanım Alanı / Dikkat |\n' +
        '| --- | --- | --- |\n' +
        '| Gabapentinoidler | Gabapentin, pregabalin | Seçilmiş nöropatik ağrılar; sedasyon, baş dönmesi, ödem |\n' +
        '| SNRI | Duloksetin, venlafaksin | Nöropatik ağrı, fibromiyalji vb.; bulantı, tansiyon/serotonerjik etkiler |\n' +
        '| TCA | Amitriptilin | Nöropatik ağrı; antikolinerjik ve kardiyak etkiler |\n' +
        '| Lokal/topikal | Lidokain, kapsaisin | Lokalize nöropatik ağrıda seçilmiş kullanım |\n' +
        '| Kortikosteroid | Deksametazon vb. | Ödem/inflamasyonla ilişkili seçilmiş ağrı durumları |\n' +
        '| α2 agonist | Klonidin, deksmedetomidin | Seçilmiş perioperatif/adjuvan kullanım |'
    )
  })

  it('produces the same table through the DOM text-layer extractor', () => {
    document.body.innerHTML = ''
    invalidatePageCache(31)

    const pageBox = document.createElement('div')
    pageBox.setAttribute('data-native-pdf-page', '31')
    const layer = document.createElement('div')
    layer.setAttribute('data-native-pdf-text-layer', '')
    layer.setAttribute('data-native-pdf-text-page', '31')

    for (const item of ADJUVAN_PAGE) {
      const span = document.createElement('span')
      span.setAttribute('role', 'presentation')
      span.textContent = item.text
      Object.defineProperty(span, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: item.left,
          top: item.top,
          right: item.left + item.width,
          bottom: item.top + item.height,
          width: item.width,
          height: item.height,
          x: item.left,
          y: item.top,
          toJSON: () => ({})
        })
      })
      span.style.setProperty('--font-height', `${item.fontSize}px`)
      layer.appendChild(span)
    }

    pageBox.appendChild(layer)
    document.body.appendChild(pageBox)

    expect(extractPageTextFromDom(31)).toBe(page(ADJUVAN_PAGE))
    document.body.innerHTML = ''
    invalidatePageCache(31)
  })
})

describe('pdf tables — long cells and table shape', () => {
  it('keeps a cell longer than 45 characters as a table cell', () => {
    const text = page([
      run('Bulgu', 50, 100, 80),
      run('Açıklama', 220, 100, 240),
      run('Ateş', 50, 120, 80),
      run('Kırk beş karakterden uzun bir açıklama hücresi burada', 220, 120, 240),
      run('Nabız', 50, 140, 80),
      run('Kısa açıklama', 220, 140, 120),
      run('Solunum', 50, 160, 80),
      run('Bir başka açıklama', 220, 160, 160)
    ])

    expect(text).toBe(
      '| Bulgu | Açıklama |\n' +
        '| --- | --- |\n' +
        '| Ateş | Kırk beş karakterden uzun bir açıklama hücresi burada |\n' +
        '| Nabız | Kısa açıklama |\n' +
        '| Solunum | Bir başka açıklama |'
    )
  })

  it('keeps a cell longer than 100 characters as a table cell', () => {
    const longCell =
      'Bu hücre yüz karakterden uzun olmasına rağmen tablo hücresi olarak kalmalı ve satır ilişkisi korunmalıdır.'
    expect(longCell.length).toBeGreaterThan(100)

    const text = page([
      run('İlaç', 50, 100, 80),
      run('Yan etki', 220, 100, 240),
      run('Gabapentin', 50, 120, 80),
      run(longCell, 220, 120, 240),
      run('Amitriptilin', 50, 140, 80),
      run('Antikolinerjik etkiler', 220, 140, 160),
      run('Klonidin', 50, 160, 80),
      run('Sedasyon', 220, 160, 120)
    ])

    expect(text).toContain(`| Gabapentin | ${longCell} |`)
    expect(text).toContain('| --- | --- |')
  })

  it('keeps a header with a larger, bolder font attached to its data rows', () => {
    const text = page([
      run('Grup', 50, 100, 50, 16),
      run('Örnek', 200, 100, 80, 16),
      run('Dikkat', 380, 100, 120, 16),
      run('Birinci', 50, 130, 60, 11),
      run('Örnek bir', 200, 130, 100, 11),
      run('Dikkat edilecek ilk durum', 380, 130, 180, 11),
      run('İkinci', 50, 160, 60, 11),
      run('Örnek iki', 200, 160, 100, 11),
      run('Dikkat edilecek ikinci durum', 380, 160, 180, 11),
      run('Üçüncü', 50, 190, 60, 11),
      run('Örnek üç', 200, 190, 100, 11),
      run('Dikkat edilecek üçüncü durum', 380, 190, 180, 11)
    ])

    expect(text).toBe(
      '| Grup | Örnek | Dikkat |\n' +
        '| --- | --- | --- |\n' +
        '| Birinci | Örnek bir | Dikkat edilecek ilk durum |\n' +
        '| İkinci | Örnek iki | Dikkat edilecek ikinci durum |\n' +
        '| Üçüncü | Örnek üç | Dikkat edilecek üçüncü durum |'
    )
  })

  it('keeps a table together when the header has an extra gap above the body', () => {
    const text = page([
      run('Grup', 50, 100, 50),
      run('Örnek', 200, 100, 80),
      run('Dikkat', 380, 100, 120),
      run('Birinci', 50, 150, 60),
      run('Örnek bir', 200, 150, 100),
      run('Dikkat edilecek ilk durum', 380, 150, 180),
      run('İkinci', 50, 170, 60),
      run('Örnek iki', 200, 170, 100),
      run('Dikkat edilecek ikinci durum', 380, 170, 180),
      run('Üçüncü', 50, 190, 60),
      run('Örnek üç', 200, 190, 100),
      run('Dikkat edilecek üçüncü durum', 380, 190, 180)
    ])

    expect(text).toBe(
      '| Grup | Örnek | Dikkat |\n' +
        '| --- | --- | --- |\n' +
        '| Birinci | Örnek bir | Dikkat edilecek ilk durum |\n' +
        '| İkinci | Örnek iki | Dikkat edilecek ikinci durum |\n' +
        '| Üçüncü | Örnek üç | Dikkat edilecek üçüncü durum |'
    )
  })
})

describe('pdf tables — wrapped, missing and merged cells', () => {
  it('joins wrapped lines inside one cell without mixing data rows', () => {
    const text = page([
      run('İlaç', 50, 100, 40),
      run('Yan etki', 200, 100, 60),
      run('Gabapentin', 50, 120, 60),
      run('Sedasyon, baş dönmesi, periferik ödem ve', 200, 120, 180),
      run('kilo artışı', 200, 134, 70),
      run('Amitriptilin', 50, 160, 60),
      run('Antikolinerjik etkiler, ortostatik hipotansiyon', 200, 160, 180),
      run('ve kardiyak iletim bozuklukları', 200, 174, 150)
    ])

    expect(text).toBe(
      '| İlaç | Yan etki |\n' +
        '| --- | --- |\n' +
        '| Gabapentin | Sedasyon, baş dönmesi, periferik ödem ve kilo artışı |\n' +
        '| Amitriptilin | Antikolinerjik etkiler, ortostatik hipotansiyon ve kardiyak iletim bozuklukları |'
    )
  })

  it('preserves rows when a cell is missing and never invents one', () => {
    const text = page([
      run('A', 50, 100, 50),
      run('B', 200, 100, 50),
      run('C', 380, 100, 120),
      run('birinci', 50, 120, 70),
      run('ikinci', 200, 120, 70),
      run('üçüncü', 380, 120, 140),
      run('dördüncü', 200, 140, 80),
      run('beşinci', 380, 140, 140),
      run('altıncı', 50, 160, 70),
      run('yedinci', 200, 160, 80),
      run('sekizinci', 380, 160, 140)
    ])

    expect(text).not.toContain('| --- |')
    expect(text).toContain('A | B | C')
    expect(text).toContain('birinci | ikinci | üçüncü')
    expect(text).toContain('dördüncü | beşinci')
    expect(text).toContain('altıncı | yedinci | sekizinci')
    expect(text).not.toContain('dördüncü | beşinci\n\n')
  })

  it('keeps a merged row in its own row instead of merging it into another row', () => {
    const text = page([
      run('A', 50, 100, 60),
      run('B', 200, 100, 60),
      run('C', 380, 100, 120),
      run('birinci', 50, 120, 70),
      run('ikinci', 200, 120, 70),
      run('üçüncü', 380, 120, 140),
      run('Birleşik açıklama', 50, 140, 300),
      run('altıncı', 50, 160, 70),
      run('yedinci', 200, 160, 80),
      run('sekizinci', 380, 160, 140)
    ])

    expect(text).not.toContain('| --- |')
    expect(text).toContain('Birleşik açıklama:')
    expect(text).toContain('birinci:')
    expect(text).toContain('altıncı:')
  })
})

describe('pdf tables — false positives and fallbacks', () => {
  it('serializes a short two-column label/value table', () => {
    const text = page([
      run('Bulgu', 50, 100, 80),
      run('Sonuç', 200, 100, 40),
      run('Ateş', 50, 120, 80),
      run('38 °C', 200, 120, 40),
      run('Nabız', 50, 140, 80),
      run('92', 200, 140, 40),
      run('Solunum', 50, 160, 80),
      run('18', 200, 160, 40)
    ])

    expect(text).toBe(
      '| Bulgu | Sonuç |\n| --- | --- |\n| Ateş | 38 °C |\n| Nabız | 92 |\n| Solunum | 18 |'
    )
  })

  it('does not turn two equal-width prose columns into a table', () => {
    const text = page([
      run('Sol sütunun ilk satırı', 50, 100, 170),
      run('Sağ sütunun ilk satırı', 320, 100, 170),
      run('Sol sütunun ikinci satırı', 50, 114, 170),
      run('Sağ sütunun ikinci satırı', 320, 114, 170),
      run('Sol sütunun üçüncü satırı', 50, 128, 170),
      run('Sağ sütunun üçüncü satırı', 320, 128, 170)
    ])

    expect(text).not.toContain('| --- |')
    expect(text).toContain(
      'Sol sütunun ilk satırı Sol sütunun ikinci satırı Sol sütunun üçüncü satırı'
    )
    expect(text).toContain(
      'Sağ sütunun ilk satırı Sağ sütunun ikinci satırı Sağ sütunun üçüncü satırı'
    )
  })

  it('does not turn three equal-width prose columns into a table', () => {
    const text = page([
      run('Birinci sütunun birinci satırı', 50, 100, 150),
      run('İkinci sütunun birinci satırı', 220, 100, 150),
      run('Üçüncü sütunun birinci satırı', 390, 100, 150),
      run('Birinci sütunun ikinci satırı', 50, 114, 150),
      run('İkinci sütunun ikinci satırı', 220, 114, 150),
      run('Üçüncü sütunun ikinci satırı', 390, 114, 150),
      run('Birinci sütunun üçüncü satırı', 50, 128, 150),
      run('İkinci sütunun üçüncü satırı', 220, 128, 150),
      run('Üçüncü sütunun üçüncü satırı', 390, 128, 150)
    ])

    expect(text).not.toContain('| --- |')
    expect(text).toContain(
      'Birinci sütunun birinci satırı Birinci sütunun ikinci satırı Birinci sütunun üçüncü satırı'
    )
    expect(text).toContain(
      'Üçüncü sütunun birinci satırı Üçüncü sütunun ikinci satırı Üçüncü sütunun üçüncü satırı'
    )
  })
})

describe('pdf tables — surrounding content', () => {
  it('keeps a heading before the table as a real heading', () => {
    const text = page([
      run('Adjuvan Başlık', 50, 60, 200, 20),
      run('Grup', 50, 120, 50),
      run('Örnek', 200, 120, 80),
      run('Dikkat', 380, 120, 120),
      run('Birinci', 50, 140, 60),
      run('Örnek bir', 200, 140, 100),
      run('Dikkat edilecek ilk durum', 380, 140, 180),
      run('İkinci', 50, 160, 60),
      run('Örnek iki', 200, 160, 100),
      run('Dikkat edilecek ikinci durum', 380, 160, 180)
    ])

    expect(text.startsWith('## Adjuvan Başlık\n\n| Grup | Örnek | Dikkat |')).toBe(true)
    expect(text).not.toContain('#### Grup')
  })

  it('keeps a paragraph after the table out of the table', () => {
    const text = page([
      run('Bulgu', 50, 100, 80),
      run('Açıklama', 220, 100, 30),
      run('Ateş', 50, 120, 80),
      run('Yüksek', 220, 120, 30),
      run('Nabız', 50, 140, 80),
      run('Normal', 220, 140, 30),
      run('Tablo sonrası paragraf burada devam ediyor.', 50, 200, 300)
    ])

    expect(text).toBe(
      '| Bulgu | Açıklama |\n' +
        '| --- | --- |\n' +
        '| Ateş | Yüksek |\n' +
        '| Nabız | Normal |\n\n' +
        'Tablo sonrası paragraf burada devam ediyor.'
    )
  })

  it('keeps two separate tables on one page separate', () => {
    const text = page([
      run('A', 50, 100, 60),
      run('B', 200, 100, 120),
      run('birinci', 50, 120, 70),
      run('ikinci', 200, 120, 100),
      run('üçüncü', 50, 140, 70),
      run('dördüncü', 200, 140, 100),
      run('C', 50, 330, 60),
      run('D', 200, 330, 120),
      run('beşinci', 50, 350, 70),
      run('altıncı', 200, 350, 100),
      run('yedinci', 50, 370, 70),
      run('sekizinci', 200, 370, 100)
    ])

    expect(text).toBe(
      '| A | B |\n| --- | --- |\n| birinci | ikinci |\n| üçüncü | dördüncü |\n\n' +
        '| C | D |\n| --- | --- |\n| beşinci | altıncı |\n| yedinci | sekizinci |'
    )
  })
})

describe('pdf tables — characters and selection', () => {
  it('preserves Turkish and medical notation inside cells', () => {
    const text = page([
      run('Parametre', 50, 100, 90),
      run('Değer', 220, 100, 200),
      run('α2 agonist', 50, 120, 90),
      run('β, Na⁺, HCO₃⁻', 220, 120, 200),
      run('Eşik', 50, 140, 90),
      run('≥ 5 µg; ≤ 10 mg/dL; %95', 220, 140, 200),
      run('Türkçe', 50, 160, 90),
      run('İğdır, şube, ölçüm', 220, 160, 200)
    ])

    expect(text).toBe(
      '| Parametre | Değer |\n' +
        '| --- | --- |\n' +
        '| α2 agonist | β, Na⁺, HCO₃⁻ |\n' +
        '| Eşik | ≥ 5 µg; ≤ 10 mg/dL; %95 |\n' +
        '| Türkçe | İğdır, şube, ölçüm |'
    )
  })

  it('produces the same row/column structure for a full-table selection', () => {
    const items = [
      run('Grup', 50, 100, 50, 14),
      run('Örnek', 200, 100, 80, 14),
      run('Dikkat', 380, 100, 120, 14),
      run('Birinci', 50, 130, 60, 12),
      run('Örnek bir', 200, 130, 100, 12),
      run('Dikkat edilecek ilk durum', 380, 130, 180, 12),
      run('İkinci', 50, 160, 60, 12),
      run('Örnek iki', 200, 160, 100, 12),
      run('Dikkat edilecek ikinci durum', 380, 160, 180, 12),
      run('Üçüncü', 50, 190, 60, 12),
      run('Örnek üç', 200, 190, 100, 12),
      run('Dikkat edilecek üçüncü durum', 380, 190, 180, 12)
    ]

    expect(selection(items)).toBe(page(items))
    expect(selection(items)).toContain('| Grup | Örnek | Dikkat |')
  })

  it('never adds unselected rows to a partial table selection', () => {
    const selected = ADJUVAN_PAGE.filter((item) => item.top >= 147 && item.top <= 252.4)
    const text = selection(selected)

    expect(text).toBe(
      '| Grup | Örnek | Kullanım Alanı / Dikkat |\n' +
        '| --- | --- | --- |\n' +
        '| Gabapentinoidler | Gabapentin, pregabalin | Seçilmiş nöropatik ağrılar; sedasyon, baş dönmesi, ödem |\n' +
        '| SNRI | Duloksetin, venlafaksin | Nöropatik ağrı, fibromiyalji vb.; bulantı, tansiyon/serotonerjik etkiler |'
    )
    expect(text).not.toContain('TCA')
  })

  it('does not invent a header when the selected rows start below it', () => {
    const selected = ADJUVAN_PAGE.filter((item) => item.top >= 194 && item.top <= 310)
    const text = selection(selected)

    expect(text).not.toContain('| --- |')
    expect(text).not.toContain('Grup')
    expect(text).not.toContain('Örnek')
    expect(text).toContain(
      'Gabapentinoidler | Gabapentin, pregabalin | Seçilmiş nöropatik ağrılar; sedasyon, baş dönmesi, ödem'
    )
    expect(text).toContain(
      'SNRI | Duloksetin, venlafaksin | Nöropatik ağrı, fibromiyalji vb.; bulantı, tansiyon/serotonerjik etkiler'
    )
    expect(text).toContain(
      'TCA | Amitriptilin | Nöropatik ağrı; antikolinerjik ve kardiyak etkiler'
    )
  })

  it('keeps page boundaries when a selection spans two pages', () => {
    const items: PdfTextItem[] = [
      { ...run('Grup', 50, 100, 50, 14), page: 1 },
      { ...run('Örnek', 200, 100, 80, 14), page: 1 },
      { ...run('Birinci', 50, 130, 60, 12), page: 1 },
      { ...run('Örnek bir', 200, 130, 100, 12), page: 1 },
      { ...run('İkinci', 50, 160, 60, 12), page: 1 },
      { ...run('Örnek iki', 200, 160, 100, 12), page: 1 },
      { ...run('İkinci sayfa metni', 50, 100, 200, 12), page: 2 }
    ]

    expect(selection(items)).toBe(
      '| Grup | Örnek |\n' +
        '| --- | --- |\n' +
        '| Birinci | Örnek bir |\n' +
        '| İkinci | Örnek iki |\n\n' +
        'İkinci sayfa metni'
    )
  })
})
